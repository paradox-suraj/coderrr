import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log("🧪 Testing Client Bundle Size & Static Dataset Isolation (HIGH-01)...");

// 1. Verify src/app/companies/compare/page.tsx does not import large JSON datasets statically
const comparePagePath = path.resolve(__dirname, "../src/app/companies/compare/page.tsx");
const compareContent = fs.readFileSync(comparePagePath, "utf-8");

const hasStaticProblemsImport = /import\s+.*from\s+['"].*problems\.json['"]/.test(compareContent);
const hasStaticMappingsImport = /import\s+.*from\s+['"].*company_mappings\.json['"]/.test(compareContent);

assert(
  !hasStaticProblemsImport,
  "src/app/companies/compare/page.tsx must not statically import problems.json"
);
assert(
  !hasStaticMappingsImport,
  "src/app/companies/compare/page.tsx must not statically import company_mappings.json"
);

// 2. Scan all client components for static imports of problems.json
function scanDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.includes("'use client'") || content.includes('"use client"')) {
        const hasStaticJsonImport = /^\s*import\s+.*from\s+['"].*problems\.json['"]/m.test(content);
        assert(
          !hasStaticJsonImport,
          `Client component ${path.relative(process.cwd(), fullPath)} must not statically import problems.json`
        );
      }
    }
  }
}
scanDir(path.resolve(__dirname, "../src"));

// 3. Verify built chunk size for companies/compare if build exists
const compareChunkDir = path.resolve(__dirname, "../.next/static/chunks/app/companies/compare");
if (fs.existsSync(compareChunkDir)) {
  const files = fs.readdirSync(compareChunkDir).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const filePath = path.join(compareChunkDir, file);
    const sizeBytes = fs.statSync(filePath).size;
    const sizeKB = (sizeBytes / 1024).toFixed(1);
    assert(
      sizeBytes <= 200 * 1024,
      `Chunk ${file} in companies/compare must be <= 200 KB (found: ${sizeKB} KB)`
    );
  }
}

console.log("🎉 All bundle size and dataset isolation checks passed!");
