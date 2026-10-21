import { executeBlock } from "../src/lib/sandbox/executor";
import { buildPreviewHtml } from "../src/lib/sandbox/previewHelper";

async function verify() {
  console.log("--- 1. Testing JavaScript Execution in Sandbox ---");
  const jsResult = await executeBlock(
    "const a = 21; const b = 2; console.log('Computation result:', a * b);",
    "javascript"
  );
  console.log("JS Result:", {
    stdout: jsResult.stdout.trim(),
    exitCode: jsResult.exitCode,
    provider: jsResult.provider,
    durationMs: jsResult.durationMs,
  });

  console.log("\n--- 2. Testing Python Execution in Sandbox ---");
  const pyResult = await executeBlock(
    "vals = [1, 2, 3, 4, 5]\nprint('Sum of array:', sum(vals))",
    "python"
  );
  console.log("Python Result:", {
    stdout: pyResult.stdout.trim(),
    exitCode: pyResult.exitCode,
    provider: pyResult.provider,
    durationMs: pyResult.durationMs,
  });

  console.log("\n--- 3. Testing Live Preview HTML Generation ---");
  const previewHtml = buildPreviewHtml(
    `export default function Counter() {
      const [count, setCount] = React.useState(0);
      return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
    }`,
    "tsx"
  );
  console.log("Preview generated successfully! Length:", previewHtml.length);
  console.log("Contains Tailwind CDN:", previewHtml.includes("cdn.tailwindcss.com"));
  console.log("Contains Babel Standalone:", previewHtml.includes("babel.min.js"));
  console.log("Contains React 18 CDN:", previewHtml.includes("react.production.min.js"));
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
