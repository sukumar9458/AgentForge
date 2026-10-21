import type { CodeBlock, ExecutionResult } from "../src/lib/sandbox/executor";

export type FailureReason = "PASS" | "NO_CODE" | "EXEC_FAIL" | "TIMEOUT";

export interface SandboxVerdict {
  passed: boolean;
  reason: FailureReason;
  blockCount: number;
  failedBlocks: number;
}

export function classifySandboxRun(
  runs: Array<{ block: CodeBlock; result: ExecutionResult }>
): SandboxVerdict {
  if (runs.length === 0) {
    return { passed: false, reason: "NO_CODE", blockCount: 0, failedBlocks: 0 };
  }

  let failedBlocks = 0;
  let timedOut = false;

  for (const { result } of runs) {
    const isTimeout = result.error === "TIMEOUT" || /TIMEOUT/i.test(result.error || "");
    if (isTimeout) {
      timedOut = true;
      failedBlocks += 1;
      continue;
    }
    if (result.exitCode !== 0) {
      failedBlocks += 1;
    }
  }

  if (failedBlocks === 0) {
    return { passed: true, reason: "PASS", blockCount: runs.length, failedBlocks: 0 };
  }

  return {
    passed: false,
    reason: timedOut ? "TIMEOUT" : "EXEC_FAIL",
    blockCount: runs.length,
    failedBlocks,
  };
}

/** (baselineFails - treatmentFails) / baselineFails. 0 if baseline had no failures. */
export function errorReductionRate(baselineFails: number, treatmentFails: number): number {
  if (baselineFails <= 0) return 0;
  return (baselineFails - treatmentFails) / baselineFails;
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
