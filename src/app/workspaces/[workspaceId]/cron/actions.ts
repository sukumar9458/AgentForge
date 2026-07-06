"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { CronJob } from "@/models/CronJob";
import { runBackgroundJob } from "@/lib/cron/scheduler";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";

interface SaveCronArgs {
  jobId?: string;
  workspaceId: string;
  name: string;
  type: "workspace" | "github";
  githubRepo?: string;
  email?: string;
  prompt: string;
  dayOfWeek: string;
  hour: number;
  minute?: number;
  second?: number;
}

/**
 * Creates or updates an AI Cron Workflow schedule.
 */
export async function saveCronJob(args: SaveCronArgs) {
  try {
    await connectToDatabase();

    const {
      jobId,
      workspaceId,
      name,
      type,
      githubRepo,
      email,
      prompt,
      dayOfWeek,
      hour,
      minute,
      second,
    } = args;

    if (!name || !prompt || hour === undefined) {
      return { success: false, error: "Missing required fields." };
    }

    const jobData: any = {
      name,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      type,
      prompt,
      dayOfWeek,
      hour: Number(hour),
      minute: Number(minute ?? 0),
      second: Number(second ?? 0),
      email: email || undefined,
      githubRepo: type === "github" ? githubRepo : undefined,
    };

    if (jobId) {
      await CronJob.findByIdAndUpdate(jobId, jobData);
    } else {
      await CronJob.create(jobData);
    }

    revalidatePath(`/workspaces/${workspaceId}/cron`);
    return { success: true };
  } catch (error: any) {
    console.error("Save cron job error:", error);
    return { success: false, error: error.message || "Failed to save workflow." };
  }
}

/**
 * Deletes a cron schedule record.
 */
export async function deleteCronJob(workspaceId: string, jobId: string) {
  try {
    await connectToDatabase();
    await CronJob.findByIdAndDelete(jobId);
    revalidatePath(`/workspaces/${workspaceId}/cron`);
    return { success: true };
  } catch (error: any) {
    console.error("Delete cron job error:", error);
    return { success: false, error: error.message || "Failed to delete schedule." };
  }
}

/**
 * Toggles a schedule active state.
 */
export async function toggleCronJobActive(workspaceId: string, jobId: string, active: boolean) {
  try {
    await connectToDatabase();
    await CronJob.findByIdAndUpdate(jobId, { active });
    revalidatePath(`/workspaces/${workspaceId}/cron`);
    return { success: true };
  } catch (error: any) {
    console.error("Toggle cron active error:", error);
    return { success: false, error: error.message || "Failed to toggle schedule." };
  }
}

/**
 * Instantly triggers execution of a scheduled job in the background.
 */
export async function triggerCronJob(workspaceId: string, jobId: string) {
  try {
    await connectToDatabase();
    const job = await CronJob.findById(jobId);
    if (!job) {
      return { success: false, error: "Cron job not found." };
    }

    // Trigger asynchronous execute (without awaiting full run completion to prevent page freeze)
    runBackgroundJob(job).catch((err) => {
      console.error(`Manual trigger execution failed for job ${job.name}:`, err);
    });

    revalidatePath(`/workspaces/${workspaceId}/cron`);
    return { success: true };
  } catch (error: any) {
    console.error("Trigger cron job error:", error);
    return { success: false, error: error.message || "Failed to start execution." };
  }
}
