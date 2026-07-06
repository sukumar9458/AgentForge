import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface CodeBlock {
  language: string;
  code: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

/**
 * Regex-based parser to extract language tags and content of code blocks.
 */
export function parseCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  // Matches ```lang\n[code]\n```
  const regex = /```(\w*)\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const language = match[1]?.toLowerCase().trim() || "code";
    const code = match[2];
    blocks.push({ language, code });
  }
  return blocks;
}

/**
 * Executes a single code block by writing it to a temporary file in .sandbox/
 * and calling the appropriate CLI command with a timeout of 5000ms.
 */
export async function executeBlock(code: string, language: string): Promise<ExecutionResult> {
  const sandboxDir = path.join(process.cwd(), ".sandbox");
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true });
  }

  let ext = "";
  let cmd = "";

  const normalizedLang = language.toLowerCase().trim();
  if (normalizedLang === "javascript" || normalizedLang === "js") {
    ext = "js";
    cmd = "node";
  } else if (normalizedLang === "typescript" || normalizedLang === "ts") {
    ext = "ts";
    // Using --yes to prevent npx from prompting for installation in non-interactive shells
    cmd = "npx --yes tsx";
  } else if (normalizedLang === "python" || normalizedLang === "py") {
    ext = "py";
    cmd = "python";
  } else {
    return {
      stdout: "",
      stderr: `Unsupported language for execution: ${language}. Only JavaScript, TypeScript, and Python are supported.`,
      exitCode: 1,
      error: "UNSUPPORTED_LANGUAGE",
    };
  }

  const fileName = `run_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
  const filePath = path.join(sandboxDir, fileName);

  try {
    fs.writeFileSync(filePath, code, "utf-8");
  } catch (writeError: any) {
    return {
      stdout: "",
      stderr: `Failed to write code file: ${writeError.message}`,
      exitCode: 1,
      error: "WRITE_ERROR",
    };
  }

  return new Promise<ExecutionResult>((resolve) => {
    const fullCmd = `${cmd} "${filePath}"`;
    exec(fullCmd, { timeout: 15000 }, (error, stdout, stderr) => {
      // Clean up the temporary execution file
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.error(`Failed to delete temp file ${fileName}:`, e);
      }

      if (error) {
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString() || error.message,
          exitCode: error.code || 1,
          error: error.killed ? "TIMEOUT" : "EXEC_ERROR",
        });
      } else {
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: 0,
        });
      }
    });
  });
}

/**
 * Runs all executable blocks found in a piece of text (e.g. from an agent output)
 * and returns their aggregated execution reports.
 */
export async function executeAllBlocksInText(
  text: string
): Promise<Array<{ block: CodeBlock; result: ExecutionResult }>> {
  const blocks = parseCodeBlocks(text);
  const executableLanguages = ["javascript", "js", "typescript", "ts", "python", "py"];
  const results = [];

  for (const block of blocks) {
    if (executableLanguages.includes(block.language)) {
      const result = await executeBlock(block.code, block.language);
      results.push({ block, result });
    }
  }

  return results;
}
