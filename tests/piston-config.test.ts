import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log("🧪 Testing Piston Configuration & Dead Endpoint Elimination (HIGH-02)...");

// 1. Verify src/lib/execution/queue.ts does not fall back to unauthenticated emkc.org
const queuePath = path.resolve(__dirname, "../src/lib/execution/queue.ts");
const queueContent = fs.readFileSync(queuePath, "utf-8");

assert(
  !queueContent.includes("|| 'https://emkc.org/api/v2/piston/execute'") &&
  !queueContent.includes("|| \"https://emkc.org/api/v2/piston/execute\""),
  "queue.ts must not fall back to unauthenticated public emkc.org endpoint"
);

// 2. Test schema validation via src/lib/execution/pistonConfig.ts
import { validatePistonUrl, isPistonConfigured, getPistonEndpoint } from "../src/lib/execution/pistonConfig";

// Case A: Undefined or empty
const emptyRes = validatePistonUrl(undefined);
assert(!emptyRes.isValid, "Undefined PISTON_URL must be marked invalid");
assert(Boolean(emptyRes.reason?.includes("not configured")), "Undefined PISTON_URL must explain it is not configured");

// Case B: Invalid URL format
const invalidRes = validatePistonUrl("not-a-url");
assert(!invalidRes.isValid, "Malformed PISTON_URL must be marked invalid");

// Case C: Deprecated emkc.org without key
const emkcNoKey = validatePistonUrl("https://emkc.org/api/v2/piston/execute");
assert(!emkcNoKey.isValid, "Public emkc.org without PISTON_KEY must be rejected as deprecated");
assert(Boolean(emkcNoKey.reason?.includes("deprecated")), "emkc.org rejection must cite deprecation / auth requirement");

// Case D: Deprecated emkc.org WITH key
const emkcWithKey = validatePistonUrl("https://emkc.org/api/v2/piston/execute", "test-key-123");
assert(emkcWithKey.isValid, "emkc.org with valid key must be accepted");

// Case E: Valid self-hosted Docker endpoint
const selfHosted = validatePistonUrl("http://localhost:2000/api/v2/execute");
assert(selfHosted.isValid, "Local self-hosted Piston URL must be valid");
assert(selfHosted.url === "http://localhost:2000/api/v2/execute", "Parsed URL must match input");

// Case F: Valid custom cloud endpoint
const customCloud = validatePistonUrl("https://piston.mycompany.internal/api/v2/execute");
assert(customCloud.isValid, "Custom HTTPS Piston URL must be valid");

async function runAsyncTests() {
  // 3. Test /api/health/execution endpoint capabilities schema
  const { GET: healthExecutionGet } = await import("../src/app/api/health/execution/route");
  const healthRes = await healthExecutionGet();
  const healthBody = await healthRes.json();
  assert(typeof healthBody.ok === "boolean", "Health response must contain ok flag");
  assert(typeof healthBody.piston === "object", "Health response must contain piston object");
  assert(typeof healthBody.piston.configured === "boolean", "Health response must report piston.configured boolean");
  assert(Array.isArray(healthBody.supportedLanguages), "Health response must include supportedLanguages array");
  assert(healthBody.supportedLanguages.includes("python"), "Supported languages must always include python");
  assert(healthBody.supportedLanguages.includes("javascript"), "Supported languages must always include javascript");

  // 4. Test /api/execute early rejection when Piston is not configured
  delete process.env.PISTON_URL;
  delete process.env.PISTON_KEY;

  const { POST: executePost } = await import("../src/app/api/execute/route");
  const unconfiguredReq = new Request("http://localhost:3000/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "cpp",
      code: "#include <iostream>\nint main() { return 0; }",
    }),
  });

  const executeRes = await executePost(unconfiguredReq);
  assert(executeRes.status === 503, `Unconfigured execution must return HTTP 503 (got: ${executeRes.status})`);
  const executeBody = await executeRes.json();
  assert(executeBody.configured === false, "Execute response must report configured: false");
  assert(executeBody.error.includes("Remote execution environment not configured"), "Execute error must explain remote execution is unconfigured");

  console.log("🎉 All Piston configuration validation and early rejection tests passed!");
}

runAsyncTests().catch((err) => {
  console.error("Async test failure:", err);
  process.exit(1);
});
