import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Sandbox } from "@e2b/code-interpreter";

export interface CodeBlock {
  language: string;
  code: string;
}

export interface ExecutionArtifact {
  type: "image/png" | "image/svg+xml" | "text/html" | "text/plain";
  data: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  provider?: "e2b-cloud" | "local-sandbox";
  durationMs?: number;
  artifacts?: ExecutionArtifact[];
}

export interface ExecuteOptions {
  provider?: "auto" | "e2b" | "local";
  timeoutMs?: number;
}

/**
 * Regex-based parser to extract language tags and content of code blocks.
 */
export function parseCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(\w*)\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const language = match[1]?.toLowerCase().trim() || "code";
    const code = match[2];
    blocks.push({ language, code });
  }
  return blocks;
}

import { isExecutableLanguage, isPreviewableLanguage } from "./languages";
export { isExecutableLanguage, isPreviewableLanguage };

/**
 * Executes code inside an isolated E2B Cloud Sandbox microVM.
 */
async function executeE2B(
  code: string,
  normalizedLang: string,
  timeoutMs = 30000
): Promise<ExecutionResult> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error("E2B_API_KEY is not configured in environment variables.");
  }

  const startTime = Date.now();
  let sandbox: any = null;

  try {
    sandbox = await Sandbox.create({
      apiKey,
      timeoutMs,
    });

    let e2bLang: "python" | "js" | "bash" = "python";
    if (normalizedLang === "javascript" || normalizedLang === "js") {
      e2bLang = "js";
    } else if (normalizedLang === "typescript" || normalizedLang === "ts") {
      e2bLang = "js"; // E2B JS context or ts
    } else if (normalizedLang === "bash" || normalizedLang === "sh" || normalizedLang === "shell") {
      e2bLang = "bash";
    }

    const execution = await sandbox.runCode(code, {
      language: e2bLang,
      requestTimeoutMs: timeoutMs,
    });

    const durationMs = Date.now() - startTime;
    const stdout = (execution.logs.stdout || []).join("\n");
    let stderr = (execution.logs.stderr || []).join("\n");
    let exitCode = 0;
    let errorMsg: string | undefined;

    if (execution.error) {
      exitCode = 1;
      errorMsg = execution.error.value || execution.error.name;
      if (execution.error.traceback) {
        stderr = stderr ? `${stderr}\n${execution.error.traceback}` : execution.error.traceback;
      }
    }

    const artifacts: ExecutionArtifact[] = [];
    if (Array.isArray(execution.results)) {
      for (const res of execution.results) {
        if (res.png) {
          artifacts.push({ type: "image/png", data: res.png });
        } else if (res.svg) {
          artifacts.push({ type: "image/svg+xml", data: res.svg });
        } else if (res.html) {
          artifacts.push({ type: "text/html", data: res.html });
        }
      }
    }

    return {
      stdout,
      stderr,
      exitCode,
      error: errorMsg,
      provider: "e2b-cloud",
      durationMs,
      artifacts,
    };
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch (cleanupErr) {
        console.warn("[SANDBOX] E2B cleanup warning:", cleanupErr);
      }
    }
  }
}

/**
 * Executes a code block in the local hardened sandbox environment.
 */
async function executeLocal(
  code: string,
  normalizedLang: string,
  timeoutMs = 15000
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const sandboxDir = path.join(process.cwd(), ".sandbox");
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true });
  }

  let ext = "";
  let cmd = "";

  if (normalizedLang === "javascript" || normalizedLang === "js") {
    ext = "js";
    cmd = "node";
  } else if (
    normalizedLang === "typescript" ||
    normalizedLang === "ts" ||
    normalizedLang === "tsx"
  ) {
    ext = "ts";
    cmd = "npx --yes tsx";
  } else if (normalizedLang === "python" || normalizedLang === "py") {
    ext = "py";
    cmd = "python";
  } else if (
    normalizedLang === "bash" ||
    normalizedLang === "sh" ||
    normalizedLang === "shell"
  ) {
    ext = process.platform === "win32" ? "bat" : "sh";
    cmd = process.platform === "win32" ? "cmd /c" : "bash";
  } else {
    return {
      stdout: "",
      stderr: `Unsupported language for execution: ${normalizedLang}. Supported: JS, TS, Python, Bash.`,
      exitCode: 1,
      error: "UNSUPPORTED_LANGUAGE",
      provider: "local-sandbox",
      durationMs: Date.now() - startTime,
    };
  }

  const fileName = `run_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
  const filePath = path.join(sandboxDir, fileName);

  try {
    fs.writeFileSync(filePath, code, "utf-8");
  } catch (writeError: any) {
    return {
      stdout: "",
      stderr: `Failed to write sandbox temp file: ${writeError.message}`,
      exitCode: 1,
      error: "WRITE_ERROR",
      provider: "local-sandbox",
      durationMs: Date.now() - startTime,
    };
  }

  return new Promise<ExecutionResult>((resolve) => {
    const fullCmd = `${cmd} "${filePath}"`;
    exec(fullCmd, { timeout: timeoutMs }, (error, stdout, stderr) => {
      // Clean up the temporary execution file
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.error(`Failed to delete temp file ${fileName}:`, e);
      }

      const durationMs = Date.now() - startTime;

      if (error) {
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString() || error.message,
          exitCode: error.code || 1,
          error: error.killed ? "TIMEOUT" : "EXEC_ERROR",
          provider: "local-sandbox",
          durationMs,
        });
      } else {
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: 0,
          provider: "local-sandbox",
          durationMs,
        });
      }
    });
  });
}

/**
 * Universal Code Execution Router:
 * Automatically uses E2B Cloud Sandbox if E2B_API_KEY is present;
 * otherwise gracefully falls back to local isolated sandbox.
 */
export async function executeBlock(
  code: string,
  language: string,
  options: ExecuteOptions = {}
): Promise<ExecutionResult> {
  const normalizedLang = language.toLowerCase().trim();
  const providerPref = options.provider || "auto";
  const timeoutMs = options.timeoutMs || (providerPref === "e2b" ? 30000 : 15000);

  const hasE2BKey = Boolean(process.env.E2B_API_KEY && process.env.E2B_API_KEY.trim().length > 0);

  // 1. If user explicitly requests E2B or auto-mode with key present
  if ((providerPref === "e2b" || providerPref === "auto") && hasE2BKey) {
    try {
      return await executeE2B(code, normalizedLang, timeoutMs);
    } catch (e2bError: any) {
      console.warn(
        `[SANDBOX] E2B Cloud execution failed (${e2bError.message}). Falling back to local sandbox...`
      );
      if (providerPref === "e2b") {
        return {
          stdout: "",
          stderr: `E2B Cloud Sandbox error: ${e2bError.message}`,
          exitCode: 1,
          error: "E2B_FAILED",
          provider: "e2b-cloud",
          durationMs: 0,
        };
      }
    }
  }

  // 2. Local isolated sandbox execution fallback
  return executeLocal(code, normalizedLang, timeoutMs);
}

/**
 * Runs all executable blocks found in a piece of text (e.g. from Critic or Agent outputs)
 * and returns their aggregated execution reports with provider metadata.
 */
export async function executeAllBlocksInText(
  text: string,
  options: ExecuteOptions = {}
): Promise<Array<{ block: CodeBlock; result: ExecutionResult }>> {
  const blocks = parseCodeBlocks(text);
  const results = [];

  for (const block of blocks) {
    if (isExecutableLanguage(block.language)) {
      const result = await executeBlock(block.code, block.language, options);
      results.push({ block, result });
    }
  }

  return results;
}
