import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log("🧪 Testing Memory Metrics Integrity & Telemetry Precision...");

// 1. Verify usePyodide.ts has no hardcoded memory metrics
const pyodideHookPath = path.resolve(__dirname, "../src/lib/workers/usePyodide.ts");
const pyodideHookContent = fs.readFileSync(pyodideHookPath, "utf-8");

assert(!pyodideHookContent.includes("14.2"), "usePyodide.ts must not contain fake 14.2 MB default");
assert(!pyodideHookContent.includes("14.8"), "usePyodide.ts must not contain fake 14.8 MB fallback");

// 2. Verify codeExecutor.ts has no hardcoded memory metrics
const codeExecutorPath = path.resolve(__dirname, "../src/lib/runners/codeExecutor.ts");
const codeExecutorContent = fs.readFileSync(codeExecutorPath, "utf-8");

assert(!codeExecutorContent.includes("16.5"), "codeExecutor.ts must not contain fake 16.5 MB constant");
assert(!codeExecutorContent.includes("12.8"), "codeExecutor.ts must not contain fake 12.8 MB constant");
assert(!codeExecutorContent.includes("12.4"), "codeExecutor.ts must not contain fake 12.4 MB constant");

// 3. Verify ProblemWorkspace.tsx does not fall back to fake "12.4"
const workspacePath = path.resolve(__dirname, "../src/components/workspace/ProblemWorkspace.tsx");
const workspaceContent = fs.readFileSync(workspacePath, "utf-8");

assert(!workspaceContent.includes("'12.4'") && !workspaceContent.includes('"12.4"'), "ProblemWorkspace.tsx must not fall back to fake 12.4 MB string");

console.log("🎉 All memory metrics integrity tests passed!");
