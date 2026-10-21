import fs from "fs";
import path from "path";
import { executeAllBlocksInText } from "../src/lib/sandbox/executor";
import { CODE_ERROR_PROMPTS } from "./prompts";
import { BROKEN_CODE_FIXTURES } from "./broken-fixtures";
import {
  classifySandboxRun,
  errorReductionRate,
  formatPercent,
  type SandboxVerdict,
} from "./metrics";
import type { GraphMessage, GraphStep } from "../src/lib/agents/graph";

type AgentStateShape = {
  messages: GraphMessage[];
  next: string;
  workspaceId: string;
  steps: GraphStep[];
};

function loadDotEnv() {
  const files = [".env", ".env.local"];
  for (const file of files) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]) {
  const args = {
    selfTest: false,
    limit: CODE_ERROR_PROMPTS.length,
    maxRepairs: 2,
    ids: "" as string,
    mode: "generate" as "generate" | "fixtures",
    checkFixtures: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") args.selfTest = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--check-fixtures") args.checkFixtures = true;
    else if (a === "--mode") {
      const m = String(argv[++i] || "");
      args.mode = m === "fixtures" ? "fixtures" : "generate";
    }
    else if (a === "--limit") args.limit = Math.max(1, Number(argv[++i]));
    else if (a === "--max-repairs") args.maxRepairs = Math.max(0, Number(argv[++i]));
    else if (a === "--ids") {
      const collected: string[] = [];
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        collected.push(argv[++i]);
      }
      args.ids = collected.join(",");
    }
  }
  return args;
}

function emptyState(prompt: string): AgentStateShape {
  return {
    messages: [{ role: "user", content: prompt }],
    next: "Coder",
    workspaceId: "",
    steps: [],
  };
}

function mergeState(state: AgentStateShape, update: Partial<AgentStateShape>): AgentStateShape {
  return {
    messages: update.messages ? state.messages.concat(update.messages) : state.messages,
    next: update.next ?? state.next,
    workspaceId: update.workspaceId ?? state.workspaceId,
    steps: update.steps ? state.steps.concat(update.steps) : state.steps,
  };
}

function lastCoderContent(messages: GraphMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i].content;
    if (content.includes("[Coder Output]")) return content;
  }
  return messages[messages.length - 1]?.content || "";
}

async function scoreCode(text: string): Promise<SandboxVerdict> {
  const runs = await executeAllBlocksInText(text);
  return classifySandboxRun(runs);
}

function runSelfTest() {
  let failed = 0;
  const check = (name: string, ok: boolean) => {
    if (!ok) {
      failed += 1;
      console.error(`FAIL ${name}`);
    } else {
      console.log(`PASS ${name}`);
    }
  };

  check("no blocks is an error", classifySandboxRun([]).reason === "NO_CODE");
  check(
    "exit 0 is pass",
    classifySandboxRun([
      {
        block: { language: "js", code: "1" },
        result: { stdout: "", stderr: "", exitCode: 0 },
      },
    ]).passed
  );
  check(
    "exit 1 is exec fail",
    classifySandboxRun([
      {
        block: { language: "js", code: "1" },
        result: { stdout: "", stderr: "boom", exitCode: 1 },
      },
    ]).reason === "EXEC_FAIL"
  );
  check(
    "timeout reason",
    classifySandboxRun([
      {
        block: { language: "py", code: "1" },
        result: { stdout: "", stderr: "", exitCode: 1, error: "TIMEOUT" },
      },
    ]).reason === "TIMEOUT"
  );
  check("reduction 10->2 is 80%", errorReductionRate(10, 2) === 0.8);
  check("reduction with 0 baseline fails is 0", errorReductionRate(0, 0) === 0);

  if (failed > 0) {
    console.error(`\nSelf-test failed: ${failed} check(s)`);
    process.exit(1);
  }
  console.log("\nSelf-test passed. This does not prove an 85% production gain.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: npx tsx evals/run-code-error-eval.ts [options]

  --self-test         Scoring unit tests (no Gemini)
  --check-fixtures    Confirm broken snippets fail the sandbox (no Gemini)
  --mode generate     Coder-only vs Coder+Critic on live prompts (default)
  --mode fixtures     Broken first draft vs Critic repair loop
  --limit N           Cap how many cases to run
  --ids a b c         Only these ids (space-separated; PowerShell-safe)
  --max-repairs N     Extra Coder rounds after Critic FAIL (default: 2)

Error = no runnable JS/TS/Python block, non-zero exit, crash, or 15s timeout.
Wrong-but-running code counts as PASS.

Resume: use the printed percent. Do not write 85% unless this script prints 85%.`);
    return;
  }

  if (args.selfTest) {
    runSelfTest();
    return;
  }

  loadDotEnv();
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing. Add it to .env or .env.local");
    process.exit(1);
  }

  const { coderNode, criticNode } = await import("../src/lib/agents/graph");
  const idSet = new Set(
    args.ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const prompts = (idSet.size > 0
    ? CODE_ERROR_PROMPTS.filter((p) => idSet.has(p.id))
    : CODE_ERROR_PROMPTS
  ).slice(0, args.limit);

  if (prompts.length === 0) {
    console.error(
      "No prompts selected. Valid ids:\n" +
        CODE_ERROR_PROMPTS.map((p) => `  ${p.id}`).join("\n")
    );
    process.exit(1);
  }

  type Row = {
    id: string;
    title: string;
    baseline: SandboxVerdict;
    treatment: SandboxVerdict;
    coderAttempts: number;
  };

  const rows: Row[] = [];

  console.log(
    `Running code-error eval: ${prompts.length} prompts, maxRepairs=${args.maxRepairs}\n`
  );

  for (const item of prompts) {
    process.stdout.write(`${item.id} baseline... `);
    const baselineState = mergeState(emptyState(item.prompt), await coderNode(emptyState(item.prompt)));
    const baseline = await scoreCode(lastCoderContent(baselineState.messages));
    console.log(baseline.passed ? "PASS" : baseline.reason);

    process.stdout.write(`${item.id} critic-loop... `);
    let state = emptyState(item.prompt);
    let coderAttempts = 0;
    let treatment: SandboxVerdict = {
      passed: false,
      reason: "NO_CODE",
      blockCount: 0,
      failedBlocks: 0,
    };

    while (true) {
      state = mergeState(state, await coderNode(state));
      coderAttempts += 1;
      state = mergeState(state, await criticNode(state));
      treatment = await scoreCode(lastCoderContent(state.messages));
      if (treatment.passed || state.next === "Writer") break;
      if (coderAttempts >= 1 + args.maxRepairs) break;
    }
    console.log(
      `${treatment.passed ? "PASS" : treatment.reason} (coder x${coderAttempts})`
    );

    rows.push({
      id: item.id,
      title: item.title,
      baseline,
      treatment,
      coderAttempts,
    });
  }

  const baselineFails = rows.filter((r) => !r.baseline.passed).length;
  const treatmentFails = rows.filter((r) => !r.treatment.passed).length;
  const n = rows.length;
  const reduction = errorReductionRate(baselineFails, treatmentFails);

  const summary = {
    measuredAt: new Date().toISOString(),
    promptCount: n,
    maxRepairs: args.maxRepairs,
    metric:
      "runtime error = no executable block OR exitCode !== 0 OR sandbox timeout (15s)",
    baselineFailCount: baselineFails,
    baselineFailRate: n ? baselineFails / n : 0,
    treatmentFailCount: treatmentFails,
    treatmentFailRate: n ? treatmentFails / n : 0,
    errorReductionRate: reduction,
    errorReductionPercent: formatPercent(reduction),
    resumeWarning:
      n < 20
        ? "Sample is small. Do not claim 85% from this run unless the printed reduction is 85% on a larger set."
        : "Use the printed errorReductionPercent only. Do not round up to 85%.",
    rows,
  };

  const outDir = path.join(process.cwd(), "evals", "results");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `code-errors-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), "utf8");

  console.log("\n--- Results ---");
  console.log(`Prompts: ${n}`);
  console.log(
    `Baseline (Coder only) failures: ${baselineFails}/${n} (${formatPercent(n ? baselineFails / n : 0)})`
  );
  console.log(
    `With Critic retries failures: ${treatmentFails}/${n} (${formatPercent(n ? treatmentFails / n : 0)})`
  );
  console.log(`Error reduction vs baseline: ${formatPercent(reduction)}`);
  console.log(`Saved: ${outFile}`);
  console.log(`\n${summary.resumeWarning}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
