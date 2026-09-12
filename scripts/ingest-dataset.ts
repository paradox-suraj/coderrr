import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration ──────────────────────────────────────────────────────────────

const EXCEL_PATH = path.resolve(
  __dirname,
  '../LeetCode_Companywise_Grouped_By_Same_Question .xlsx'
);
const OUT_DIR = path.resolve(__dirname, '../public/data');
const DESCRIPTIONS_DIR = path.resolve(__dirname, '../public/data/descriptions');
const HF_DESCRIPTIONS_PATH = path.resolve(
  __dirname,
  '../src/data/leetcode_hf_descriptions.json'
);
const PREMIUM_DESCRIPTIONS_PATH = path.resolve(
  __dirname,
  '../src/data/leetcode_premium_descriptions.json'
);
const TEMP_PREMIUM_REPO_PATH = path.resolve(__dirname, '../temp_premium_repo');

// ─── System Design Mapping (Alex Xu Vols 1 & 2) ────────────────────────────────

const SYSTEM_DESIGN_MAP: Record<string, { chapter: string; title: string }[]> = {
  '01 - Fundamentals / Math / Simulation': [
    { chapter: 'Ch 1', title: 'Scale From Zero to Millions of Users' },
    { chapter: 'Ch 2', title: 'Back-of-the-Envelope Estimation' },
  ],
  '02 - Hashing / Sorting / Counting': [
    { chapter: 'Ch 5', title: 'Design Consistent Hashing' },
    { chapter: 'Ch 6', title: 'Design a Key-Value Store' },
  ],
  '03 - Search / Window / Pointer Patterns': [
    { chapter: 'Ch 4', title: 'Design a Rate Limiter' },
  ],
  '04 - Linear Data Structures / Heap': [
    { chapter: 'Ch 19', title: 'Design a Distributed Message Queue' },
  ],
  '05 - Trees / Graph Traversal': [
    { chapter: 'Ch 11', title: 'Design a News Feed System' },
    { chapter: 'Ch 15', title: 'Design Google Drive' },
  ],
  '06 - Greedy / Prefix Sum / Intervals': [
    { chapter: 'Ch 3', title: 'A Framework for System Design Interviews' },
    { chapter: 'Ch 7', title: 'Design a Unique ID Generator' },
  ],
  '07 - Backtracking / Trie': [
    { chapter: 'Ch 13', title: 'Design Search Autocomplete System' },
  ],
  '08 - Dynamic Programming': [
    { chapter: 'Ch 10', title: 'Design a Notification System' },
    { chapter: 'Ch 18', title: 'Design a Payment System' },
  ],
  '09 - Advanced Graph / Range Queries': [
    { chapter: 'Ch 14', title: 'Design YouTube' },
    { chapter: 'Ch 16', title: 'Design a Proximity Service' },
  ],
  '10 - Special Topics / Design / SQL': [
    { chapter: 'Ch 8', title: 'Design a URL Shortener' },
    { chapter: 'Ch 9', title: 'Design a Web Crawler' },
    { chapter: 'Ch 12', title: 'Design a Chat System' },
  ],
};

// ─── Priority Bucket Thresholds ─────────────────────────────────────────────────

function getPriorityBucket(companiesCount: number): string {
  if (companiesCount >= 20) return 'Ultra High Priority (20+ companies)';
  if (companiesCount >= 10) return 'Very High Priority (10-19 companies)';
  if (companiesCount >= 5) return 'High Priority (5-9 companies)';
  if (companiesCount >= 2) return 'Medium Priority (2-4 companies)';
  return 'Standard (1 company)';
}

// ─── Slug Extraction ────────────────────────────────────────────────────────────

function extractSlug(url: string): string {
  const match = url.match(/\/problems\/([^/]+)/);
  return match ? match[1] : '';
}

// ─── Type Definitions ───────────────────────────────────────────────────────────

interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  problemType: string;
  corePattern: string;
  allTopics: string[];
  learningTrack: string;
  companiesCount: number;
  maxFrequency: number;
  avgAcceptance: number;
  url: string;
  priorityBucket: string;
  systemDesignLinks: { chapter: string; title: string }[];
  descriptionHtml?: string;
  isPaidOnly?: boolean;
}

interface CompanyMapping {
  company: string;
  problemId: string;
  frequencyPct: number;
}

interface Company {
  name: string;
  questionCount: number;
  avgFrequency: number;
}

// ─── Main Ingestion ─────────────────────────────────────────────────────────────

function main() {
  console.log('📖 Reading workbook:', EXCEL_PATH);
  const workbook = XLSX.readFile(EXCEL_PATH);

  // Verify expected sheets
  const requiredSheets = ['Unique Problems', 'All Questions'];
  for (const sheet of requiredSheets) {
    if (!workbook.SheetNames.includes(sheet)) {
      console.error(`❌ Missing required sheet: "${sheet}"`);
      console.error('   Available sheets:', workbook.SheetNames);
      process.exit(1);
    }
  }

  // Load descriptions catalog if available
  let hfDescriptionsBySlug = new Map<string, any>();
  let hfDescriptionsById = new Map<string, any>();
  if (fs.existsSync(HF_DESCRIPTIONS_PATH)) {
    console.log('📚 Loading problem statements catalog from:', HF_DESCRIPTIONS_PATH);
    try {
      const hfData = JSON.parse(fs.readFileSync(HF_DESCRIPTIONS_PATH, 'utf-8'));
      for (const item of hfData) {
        if (item.titleSlug) hfDescriptionsBySlug.set(item.titleSlug, item);
        if (item.frontendQuestionId) hfDescriptionsById.set(String(item.frontendQuestionId), item);
      }
      console.log(`   ✅ Loaded descriptions for ${hfData.length} problems`);
    } catch (err: any) {
      console.warn('   ⚠️ Could not load descriptions catalog:', err.message);
    }
  }

  // Load premium descriptions catalog if available
  let premiumDescriptionsBySlug = new Map<string, any>();
  let premiumDescriptionsById = new Map<string, any>();

  // Check temp_premium_repo for on-the-fly ingestion
  if (fs.existsSync(TEMP_PREMIUM_REPO_PATH)) {
    console.log('💎 Ingesting premium problem statements from:', TEMP_PREMIUM_REPO_PATH);
    try {
      const dirs = fs
        .readdirSync(TEMP_PREMIUM_REPO_PATH, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== '.git');

      const extractedList: any[] = [];
      for (const d of dirs) {
        const readmePath = path.join(TEMP_PREMIUM_REPO_PATH, d.name, 'README.md');
        if (!fs.existsSync(readmePath)) continue;
        const content = fs.readFileSync(readmePath, 'utf-8');

        const folderMatch = d.name.match(/^0*(\d+)-(.*)$/);
        const folderId = folderMatch ? folderMatch[1] : null;
        const folderSlug = folderMatch ? folderMatch[2] : null;

        const h2Match = content.match(
          /leetcode\.com\/problems\/([^"/]+)["\/]?[^>]*>(\d+)\.\s*([^<]+)<\/a>/
        );
        const h2Slug = h2Match ? h2Match[1] : null;
        const h2Id = h2Match ? String(h2Match[2]) : null;
        const h2Title = h2Match ? h2Match[3].trim() : null;

        const bodyHtml = content.includes('<hr>')
          ? content.substring(content.indexOf('<hr>') + 4).trim()
          : content.trim();

        const item = {
          folderId,
          folderSlug,
          h2Id,
          h2Slug,
          h2Title,
          descriptionHtml: bodyHtml,
        };

        if (folderId) premiumDescriptionsById.set(folderId, item);
        if (h2Id) premiumDescriptionsById.set(h2Id, item);
        if (folderSlug) premiumDescriptionsBySlug.set(folderSlug, item);
        if (h2Slug) premiumDescriptionsBySlug.set(h2Slug, item);

        extractedList.push(item);
      }

      console.log(`   ✅ Extracted ${extractedList.length} premium descriptions from repository`);
      fs.mkdirSync(path.dirname(PREMIUM_DESCRIPTIONS_PATH), { recursive: true });
      fs.writeFileSync(PREMIUM_DESCRIPTIONS_PATH, JSON.stringify(extractedList, null, 2));
    } catch (err: any) {
      console.warn('   ⚠️ Error reading temp_premium_repo:', err.message);
    }
  }

  // Load from persistent PREMIUM_DESCRIPTIONS_PATH if exists
  if (fs.existsSync(PREMIUM_DESCRIPTIONS_PATH)) {
    try {
      const persisted = JSON.parse(fs.readFileSync(PREMIUM_DESCRIPTIONS_PATH, 'utf-8'));
      for (const item of persisted) {
        if (item.id) premiumDescriptionsById.set(String(item.id), item);
        if (item.folderId) premiumDescriptionsById.set(String(item.folderId), item);
        if (item.h2Id) premiumDescriptionsById.set(String(item.h2Id), item);
        if (item.slug) premiumDescriptionsBySlug.set(item.slug, item);
        if (item.folderSlug) premiumDescriptionsBySlug.set(item.folderSlug, item);
        if (item.h2Slug) premiumDescriptionsBySlug.set(item.h2Slug, item);
      }
      console.log(`   ✅ Loaded ${persisted.length} persisted premium descriptions`);
    } catch (err: any) {
      console.warn('   ⚠️ Error reading persisted premium descriptions:', err.message);
    }
  }

  // ─── 1. Extract Unique Problems ────────────────────────────────────────────

  console.log('\n🔹 Processing "Unique Problems" sheet...');
  const uniqueRows = XLSX.utils.sheet_to_json<Record<string, any>>(
    workbook.Sheets['Unique Problems'],
    { defval: null }
  );

  let matchedDescriptionsCount = 0;

  const problems: Problem[] = uniqueRows.map((row) => {
    const track = (row['Recommended Learning Track'] || '').trim();
    const topicsRaw = (row['All Topics'] || '') as string;
    const topics = topicsRaw
      .split('|')
      .map((t: string) => t.trim())
      .filter(Boolean);
    const companiesCount = Number(row['Companies Count']) || 0;
    const url = (row['URL'] || '') as string;
    const id = String(row['ID'] || '');
    const slug = extractSlug(url);

    // Match description from HuggingFace dataset or Premium repository
    const matchedHf = (slug && hfDescriptionsBySlug.get(slug)) || hfDescriptionsById.get(id);
    const matchedPremium =
      (slug && premiumDescriptionsBySlug.get(slug)) ||
      premiumDescriptionsById.get(id) ||
      (matchedHf?.titleSlug && premiumDescriptionsBySlug.get(matchedHf.titleSlug));

    let descriptionHtml: string | undefined = undefined;

    if (matchedHf && matchedHf.description && matchedHf.description.trim().length > 0) {
      descriptionHtml = matchedHf.description;
    } else if (
      matchedPremium &&
      matchedPremium.descriptionHtml &&
      matchedPremium.descriptionHtml.trim().length > 0
    ) {
      descriptionHtml = matchedPremium.descriptionHtml;
    }

    const isPaidOnly = !descriptionHtml;
    if (descriptionHtml) {
      matchedDescriptionsCount++;
    }

    return {
      id,
      title: (row['Title'] || '') as string,
      slug,
      difficulty: (row['Difficulty'] || 'Medium') as Problem['difficulty'],
      problemType: (row['Problem Type'] || '') as string,
      corePattern: (row['Core Pattern / Concept'] || '') as string,
      allTopics: topics,
      learningTrack: track,
      companiesCount,
      maxFrequency: Number(row['Max Frequency %']) || 0,
      avgAcceptance: Number(row['Average Acceptance %']) || 0,
      url,
      priorityBucket: getPriorityBucket(companiesCount),
      systemDesignLinks: SYSTEM_DESIGN_MAP[track] || [],
      descriptionHtml,
      isPaidOnly,
    };
  });

  console.log(`   ✅ ${problems.length} problems extracted (${matchedDescriptionsCount} with full statement & examples)`);

  // ─── 2. Extract Company Mappings ───────────────────────────────────────────

  console.log('\n🔹 Processing "All Questions" sheet...');
  const allRows = XLSX.utils.sheet_to_json<Record<string, any>>(
    workbook.Sheets['All Questions'],
    { defval: null }
  );

  const companyMappings: CompanyMapping[] = allRows.map((row) => ({
    company: (row['Company'] || '') as string,
    problemId: String(row['ID'] || ''),
    frequencyPct: Number(row['Frequency %']) || 0,
  }));

  console.log(`   ✅ ${companyMappings.length} company-problem mappings extracted`);

  // ─── 3. Derive Companies List ──────────────────────────────────────────────

  console.log('\n🔹 Deriving companies list...');
  const companyAgg = new Map<string, { count: number; freqSum: number }>();

  for (const mapping of companyMappings) {
    const existing = companyAgg.get(mapping.company);
    if (existing) {
      existing.count++;
      existing.freqSum += mapping.frequencyPct;
    } else {
      companyAgg.set(mapping.company, {
        count: 1,
        freqSum: mapping.frequencyPct,
      });
    }
  }

  const companies: Company[] = Array.from(companyAgg.entries())
    .map(([name, data]) => ({
      name,
      questionCount: data.count,
      avgFrequency: Math.round((data.freqSum / data.count) * 1000) / 1000,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`   ✅ ${companies.length} unique companies derived`);

  // ─── 4. Write Output Files ─────────────────────────────────────────────────

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const write = (filename: string, data: unknown) => {
    const filepath = path.join(OUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 0));
    const sizeKB = (fs.statSync(filepath).size / 1024).toFixed(1);
    console.log(`   📁 ${filename} → ${sizeKB} KB`);
  };

  console.log('\n🔹 Writing output files...');
  write('problems.json', problems);
  write('company_mappings.json', companyMappings);
  write('companies.json', companies);

  // Write individual description files: public/data/descriptions/${problemId}.json
  fs.mkdirSync(DESCRIPTIONS_DIR, { recursive: true });
  let descFilesCount = 0;
  for (const p of problems) {
    if (p.descriptionHtml) {
      const descFile = path.join(DESCRIPTIONS_DIR, `${p.id}.json`);
      fs.writeFileSync(
        descFile,
        JSON.stringify(
          {
            id: p.id,
            title: p.title,
            slug: p.slug,
            difficulty: p.difficulty,
            problemType: p.problemType,
            corePattern: p.corePattern,
            allTopics: p.allTopics,
            learningTrack: p.learningTrack,
            descriptionHtml: p.descriptionHtml,
            isPaidOnly: p.isPaidOnly,
          },
          null,
          0
        )
      );
      descFilesCount++;
    }
  }
  console.log(`   📁 descriptions/ → ${descFilesCount} individual problem files in public/data/descriptions/`);

  // ─── 5. Summary ────────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ✅ INGESTION COMPLETE');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Problems:             ${problems.length}`);
  console.log(`  Full Descriptions:    ${matchedDescriptionsCount}`);
  console.log(`  Company Mappings:     ${companyMappings.length}`);
  console.log(`  Companies:            ${companies.length}`);
  console.log(`  Learning Tracks:      ${new Set(problems.map((p) => p.learningTrack)).size}`);
  console.log(`  Output Dir:           ${OUT_DIR}`);
}

main();
