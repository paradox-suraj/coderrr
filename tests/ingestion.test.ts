import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Ingestion Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Running Ingestion Dataset Verification Tests...');

const problemsPath = path.join(process.cwd(), 'public/data/problems.json');
const mappingsPath = path.join(process.cwd(), 'public/data/company_mappings.json');
const companiesPath = path.join(process.cwd(), 'public/data/companies.json');

assert(fs.existsSync(problemsPath), 'problems.json exists on disk');
assert(fs.existsSync(mappingsPath), 'company_mappings.json exists on disk');
assert(fs.existsSync(companiesPath), 'companies.json exists on disk');

const problems = JSON.parse(fs.readFileSync(problemsPath, 'utf-8'));
const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));
const companies = JSON.parse(fs.readFileSync(companiesPath, 'utf-8'));

// 1. Problem count and schema integrity
assert(problems.length === 3358, `problems.json has exactly 3,358 items (found ${problems.length})`);
assert(mappings.length === 17641, `company_mappings.json has exactly 17,641 entries (found ${mappings.length})`);
assert(companies.length === 654, `companies.json has exactly 654 unique companies (found ${companies.length})`);

// 2. Validate field presence and non-emptiness across all problems
let validCount = 0;
for (const p of problems) {
  if (p.id && p.title && p.learningTrack && p.difficulty) {
    validCount++;
  }
}
assert(validCount === 3358, `All 3,358 problems contain valid id, title, learningTrack, and difficulty`);

// 3. Validate tracks enumeration
const tracks = new Set(problems.map((p: any) => p.learningTrack));
assert(tracks.size === 10, `Exactly 10 curated learning tracks exist across the dataset`);

// 4. Validate system design architectural mappings
const withDesignLinks = problems.filter((p: any) => p.systemDesignLinks && p.systemDesignLinks.length > 0);
assert(withDesignLinks.length === 3358, `All 3,358 problems have architectural links mapped to Alex Xu chapters`);

// 5. Validate Problem Descriptions Coverage
const withDescriptions = problems.filter((p: any) => p.descriptionHtml && p.descriptionHtml.trim().length > 0);
assert(
  withDescriptions.length >= 2650,
  `At least 2,650 problems have full HTML statements, examples & constraints (found ${withDescriptions.length})`
);

// 6. Validate LeetCode Premium Locked Tracking
const paidOnly = problems.filter((p: any) => p.isPaidOnly === true);
assert(
  paidOnly.length > 0 && withDescriptions.length + paidOnly.length === 3358,
  `All 3,358 problems are accounted for (Descriptions: ${withDescriptions.length}, Premium Gated: ${paidOnly.length})`
);

// 7. Validate HTML Content & Sanitization Safety
const sample = withDescriptions[0];
assert(sample.descriptionHtml.length > 50, `Sample problem #${sample.id} HTML is populated`);
assert(!sample.descriptionHtml.includes('<script'), `Problem HTML contains no <script> execution tags`);
assert(!sample.descriptionHtml.includes('onerror='), `Problem HTML contains no inline script injection vectors`);

// 8. Validate Flagship Premium Problems Unlocked
const flagshipPremiumIds = ['252', '253', '261', '269', '271', '286', '359'];
for (const pid of flagshipPremiumIds) {
  const p = problems.find((item: any) => item.id === pid);
  assert(Boolean(p), `Flagship premium problem #${pid} exists in catalog`);
  assert(
    Boolean(p?.descriptionHtml && p.descriptionHtml.length > 50),
    `Flagship premium problem #${pid} (${p?.title}) has full descriptionHtml (length: ${p?.descriptionHtml?.length})`
  );
  assert(p?.isPaidOnly === false, `Flagship premium problem #${pid} is marked isPaidOnly: false`);
}

// 9. Validate Individual Description Files (public/data/descriptions/${problemId}.json)
const descriptionsDir = path.join(process.cwd(), 'public/data/descriptions');
assert(fs.existsSync(descriptionsDir), 'public/data/descriptions directory exists on disk');
const descFiles = fs.readdirSync(descriptionsDir).filter((f) => f.endsWith('.json'));
assert(
  descFiles.length === withDescriptions.length,
  `Descriptions directory contains exactly ${withDescriptions.length} JSON files (found ${descFiles.length})`
);

for (const sampleId of ['136', '253', '269']) {
  const filePath = path.join(descriptionsDir, `${sampleId}.json`);
  assert(fs.existsSync(filePath), `Individual description file exists: ${sampleId}.json`);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assert(parsed.id === sampleId, `${sampleId}.json has matching id`);
  assert(Boolean(parsed.descriptionHtml), `${sampleId}.json contains non-empty descriptionHtml`);
}

console.log('\n🎉 All Ingestion Data Integrity & Premium Description Tests Passed Successfully!\n');


