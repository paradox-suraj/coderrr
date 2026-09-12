import fs from 'fs';
import path from 'path';
import { getCompanies, getCompanyBySlug, getCompanyProblems } from '../src/lib/data/companies';
import { companyToSlug } from '../src/lib/utils/companySlug';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Company Detail Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Running Company Detail & Logo Pipeline Tests...');

// 1. Check disk files
const rootDir = process.cwd();
const logosJsonPath = path.join(rootDir, 'public/data/company_logos.json');
const logosDir = path.join(rootDir, 'public/logos');

assert(fs.existsSync(logosJsonPath), 'company_logos.json exists on disk');
assert(fs.existsSync(logosDir), 'public/logos directory exists on disk');

const logoRegistry = JSON.parse(fs.readFileSync(logosJsonPath, 'utf-8'));
const registryKeys = Object.keys(logoRegistry);
assert(registryKeys.length === 654, `Logo registry covers all 654 companies (found ${registryKeys.length})`);

// 2. Check local SVGs
const localSvgs = fs.readdirSync(logosDir).filter((f) => f.endsWith('.svg'));
assert(localSvgs.length >= 75, `At least 75 vector logos cached locally (found ${localSvgs.length})`);

const flagshipLogos = [
  'google.svg',
  'meta.svg',
  'microsoft.svg',
  'amazon.svg',
  'apple.svg',
  'bloomberg.svg',
  'netflix.svg',
  'uber.svg',
  'tcs.svg',
  'walmart.svg',
];

for (const logo of flagshipLogos) {
  assert(fs.existsSync(path.join(logosDir, logo)), `Flagship logo exists: ${logo}`);
}

// 3. Slug mapping uniqueness
const companies = getCompanies();
assert(companies.length === 654, `getCompanies() returns 654 companies (found ${companies.length})`);

const seenSlugs = new Set<string>();
for (const c of companies) {
  const slug = companyToSlug(c.name);
  if (!slug || seenSlugs.has(slug)) {
    assert(false, `Slug collision or empty slug detected for '${slug}' from '${c.name}'`);
  }
  seenSlugs.add(slug);
}
assert(seenSlugs.size === 654, 'All 654 companies have 100% unique slugs (0 collisions)');

// 4. Test getCompanyBySlug
const testCases: [string, string, number][] = [
  ['google', 'Google', 2274],
  ['meta', 'Meta', 1366],
  ['amazon', 'Amazon', 1957],
  ['microsoft', 'Microsoft', 1374],
  ['apple', 'Apple', 303],
  ['bloomberg', 'Bloomberg', 1190],
  ['goldman-sachs', 'Goldman Sachs', 259],
  ['walmart-labs', 'Walmart Labs', 143],
  ['tcs', 'Tcs', 216],
];

for (const [slug, expectedName, expectedCount] of testCases) {
  const comp = getCompanyBySlug(slug);
  assert(comp !== undefined, `Found company by slug '${slug}'`);
  assert(comp?.name === expectedName, `Slug '${slug}' resolved to '${expectedName}' (got '${comp?.name}')`);
  assert(comp?.questionCount === expectedCount, `'${expectedName}' has ${expectedCount} questions (got ${comp?.questionCount})`);
}

// Non-existent slug
assert(getCompanyBySlug('non-existent-startup') === undefined, "Non-existent slug returns undefined");

// 5. Test getCompanyProblems joins & sorting
const googleProblems = getCompanyProblems('Google');
assert(googleProblems.length === 2274, `Google has 2,274 joined problems (found ${googleProblems.length})`);

// Check frequency sort descending
let isSorted = true;
for (let i = 0; i < googleProblems.length - 1; i++) {
  if (googleProblems[i].companyFrequencyPct < googleProblems[i + 1].companyFrequencyPct) {
    isSorted = false;
    break;
  }
}
assert(isSorted, 'All 2,274 Google questions are strictly sorted by frequency descending');

// Difficulty breakdown
let easy = 0, medium = 0, hard = 0;
for (const p of googleProblems) {
  if (p.difficulty === 'Easy') easy++;
  else if (p.difficulty === 'Medium') medium++;
  else if (p.difficulty === 'Hard') hard++;
}
assert(easy + medium + hard === 2274, `Difficulty distribution sum equals total: ${easy} + ${medium} + ${hard} = 2274`);

// Flagship problem Two Sum (#1)
const twoSum = googleProblems.find((p) => p.id === '1');
assert(twoSum !== undefined, "Two Sum #1 is in Google question list");
assert(twoSum?.companyFrequencyPct === 1.0, `Two Sum at Google has 100% frequency (found ${twoSum?.companyFrequencyPct})`);

console.log('\n🎉 All Company Detail & Logo Integration Tests Passed Successfully!\n');
