import { CronJob } from "@/models/CronJob";
import { Session } from "@/models/Session";
import { Message } from "@/models/Message";
import { VectorDocument } from "@/models/VectorDocument";
import { Workspace } from "@/models/Workspace";
import { multiAgentGraph } from "@/lib/agents/graph";
import { ingestDocumentText } from "@/lib/rag/embedder";
import { connectToDatabase } from "@/lib/db/mongodb";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { sendEmail } from "@/lib/email";

declare global {
  // eslint-disable-next-line no-var
  var cronSchedulerActive: boolean;
}

let cachedJobs: any[] = [];
let lastCacheUpdate = 0;

/**
 * Initializes the background polling scheduler inside Next.js server runtime.
 * Prevents duplicate loops across code hot-reloads using a global cached flag.
 */
export function initScheduler() {
  if (global.cronSchedulerActive) {
    return;
  }
  global.cronSchedulerActive = true;
  console.log("[SCHEDULER] Background AI Cron Runner Initialized.");

  // Check schedules every second for precise time matching
  setInterval(async () => {
    try {
      const now = new Date();
      const currentDay = now.getDay().toString(); // "0" (Sunday) to "6" (Saturday)
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const currentSec = now.getSeconds();

      // Refresh in-memory active jobs cache every 15 seconds to avoid DB load
      if (Date.now() - lastCacheUpdate > 15000) {
        await connectToDatabase();
        cachedJobs = await CronJob.find({ active: true });
        lastCacheUpdate = Date.now();
      }

      for (const job of cachedJobs) {
        const dayMatches = job.dayOfWeek === "*" || job.dayOfWeek === currentDay;
        const hourMatches = job.hour === currentHour;
        const minuteMatches = (job.minute ?? 0) === currentMin;
        const secondMatches = (job.second ?? 0) === currentSec;

        if (dayMatches && hourMatches && minuteMatches && secondMatches) {
          console.log(`[SCHEDULER] Triggering AI Cron Job: ${job.name} (ID: ${job._id})`);
          runBackgroundJob(job).catch((err) => {
            console.error(`[SCHEDULER] Cron Job ${job.name} failed to execute:`, err);
          });
        }
      }
    } catch (dbErr) {
      console.error("[SCHEDULER] Database check polling error:", dbErr);
    }
  }, 1000);
}

/**
 * Executes a cron job in the background. Can be triggered by the polling scheduler
 * or run manually by the user via a Server Action.
 */
export async function runBackgroundJob(job: any) {
  await connectToDatabase();
  console.log(`[BACKGROUND JOB] Starting Job: ${job.name} of type: ${job.type}`);

  // 1. Update schedule status in DB
  job.lastRunStatus = "RUNNING";
  job.lastRunTime = new Date();
  await job.save();

  let cloneDir = "";
  const fileKeysToCleanup: string[] = [];

  try {
    // 2. Retrieve workspace to get owner ID for Session createdBy
    const workspace = await Workspace.findById(job.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace with ID ${job.workspaceId} not found.`);
    }

    const session = await Session.create({
      workspaceId: job.workspaceId,
      title: `AI Cron Run: ${job.name}`,
      createdBy: workspace.owner,
    });

    // 3. For GitHub audits, perform a git clone and temporary RAG ingestion
    if (job.type === "github" && job.githubRepo) {
      cloneDir = path.join(process.cwd(), ".sandbox", "clones", `job_${job._id}_${Date.now()}`);
      
      console.log(`[BACKGROUND JOB] Cloning GitHub Repo: ${job.githubRepo} into ${cloneDir}`);
      fs.mkdirSync(cloneDir, { recursive: true });
      
      // Perform a fast shallow clone
      execSync(`git clone --depth 1 "${job.githubRepo}" "${cloneDir}"`, { stdio: "ignore" });

      // Find files to ingest
      const files = getFilesRecursive(cloneDir);
      // Ingest a maximum of 20 files to remain token-efficient
      const filesToIngest = files.slice(0, 20);

      console.log(`[BACKGROUND JOB] Ingesting ${filesToIngest.length} files from repository for RAG context...`);

      for (const filePath of filesToIngest) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const relativeName = path.relative(cloneDir, filePath);
          // Standardize key prefix for safety cleanup
          const fileKey = `github-clone-${job._id}-${relativeName.replace(/[^a-zA-Z0-9]/g, "-")}`;
          
          await ingestDocumentText({
            workspaceId: job.workspaceId.toString(),
            fileName: relativeName,
            fileUrl: job.githubRepo,
            fileKey: fileKey,
            textContent: content,
          });

          fileKeysToCleanup.push(fileKey);
        } catch (fileErr) {
          console.error(`Failed to ingest file ${filePath}:`, fileErr);
        }
      }
    }

    // 4. Trigger the multi-agent graph stream in background mode
    console.log(`[BACKGROUND JOB] Spawning agent graph pipeline for prompt: "${job.prompt}"`);
    const graphHistory = [{ role: "user" as const, content: job.prompt }];

    const graphStream = await multiAgentGraph.stream({
      messages: graphHistory,
      workspaceId: job.workspaceId.toString(),
      steps: [],
    }, {
      recursionLimit: 20,
    });

    let finalMessages: any[] = [];
    let finalSteps: any[] = [];

    for await (const chunk of graphStream) {
      const activeNode = Object.keys(chunk)[0];
      const nodeState = chunk[activeNode];
      if (nodeState) {
        if (nodeState.messages) {
          finalMessages = finalMessages.concat(nodeState.messages);
        }
        if (nodeState.steps) {
          finalSteps = finalSteps.concat(nodeState.steps);
        }
      }
    }

    // 5. Gather Final Response Content
    let agentResponseContent = "AI Cron execution completed but no text was output.";
    if (finalMessages.length > 0) {
      const modelMsgs = finalMessages.filter((m) => m.role === "model");
      if (modelMsgs.length > 0) {
        agentResponseContent = modelMsgs[modelMsgs.length - 1].content;
      }
    }

    // 6. Write final System Response message to Session
    await Message.create({
      sessionId: session._id,
      sender: "AgentForge System (Cron Job)",
      senderType: "agent",
      content: agentResponseContent,
      steps: finalSteps.map((s) => ({
        agentName: s.agentName,
        action: s.action,
        input: s.input || "",
        output: s.output || "",
        duration: s.duration || 0,
        timestamp: new Date(s.timestamp),
      })),
      files: [],
    });

    // 7. Update Job Status
    job.lastRunStatus = "SUCCESS";
    await job.save();

    // 8. Dispatch notification email
    if (job.email) {
      try {
        await sendEmail({
          to: job.email,
          subject: `SUCCESS - AI Cron Job "${job.name}" Completed`,
          text: `Your scheduled workflow executed successfully.\n\nSession Details: http://localhost:3000/workspaces/${job.workspaceId}/chat/${session._id}\n\nSummary:\n${agentResponseContent}`,
        });
      } catch (emailErr) {
        console.error("[BACKGROUND JOB] Failed to send success notification email:", emailErr);
      }
    }

  } catch (error: any) {
    console.error(`[BACKGROUND JOB] Error executing job ${job.name}:`, error);
    job.lastRunStatus = "FAILED";
    await job.save();

    if (job.email) {
      try {
        await sendEmail({
          to: job.email,
          subject: `FAILED - AI Cron Job "${job.name}" Failed`,
          text: `Your scheduled workflow failed to complete.\n\nError Details: ${error.message}`,
        });
      } catch (emailErr) {
        console.error("[BACKGROUND JOB] Failed to send failure notification email:", emailErr);
      }
    }
  } finally {
    // 9. Cleanup git cloned files and database chunks
    if (cloneDir && fs.existsSync(cloneDir)) {
      console.log(`[BACKGROUND JOB] Cleaning up local cloned files: ${cloneDir}`);
      try {
        fs.rmSync(cloneDir, { recursive: true, force: true });
      } catch (rmErr) {
        console.error(`Failed to delete clone directory ${cloneDir}:`, rmErr);
      }
    }

    if (fileKeysToCleanup.length > 0) {
      console.log(`[BACKGROUND JOB] Deleting temporary vector documents from MongoDB...`);
      try {
        await VectorDocument.deleteMany({ fileKey: { $in: fileKeysToCleanup } });
      } catch (dbDelErr) {
        console.error(`Failed to delete temporary vector documents:`, dbDelErr);
      }
    }
  }
}

/**
 * Helper to recursively list code files inside cloned folders.
 */
function getFilesRecursive(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file === ".git" || file === "node_modules" || file === ".next") continue;
      getFilesRecursive(filePath, fileList);
    } else {
      const baseName = file.toLowerCase();
      // Exclude lock files, build cache, minified code, and files > 50 KB
      if (
        baseName.includes("lock") ||
        baseName.includes(".tsbuildinfo") ||
        baseName.includes(".min.js") ||
        stat.size > 50 * 1024 // Skip files larger than 50 KB to remain token-efficient
      ) {
        continue;
      }
      const ext = path.extname(file).toLowerCase();
      if ([".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".md", ".env"].includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}
