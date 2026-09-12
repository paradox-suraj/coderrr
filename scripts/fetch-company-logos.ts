import fs from 'fs';
import path from 'path';

interface CompanyItem {
  name: string;
  questionCount: number;
  avgFrequency: number;
}

export interface CompanyLogoEntry {
  company: string;
  slug: string;
  localPath: string | null;
  cdnUrl: string;
}

// Curated overrides for standard SimpleIcons slugs / domains
const SLUG_OVERRIDES: Record<string, string> = {
  'Meta': 'meta',
  'Google': 'google',
  'Amazon': 'amazon',
  'Microsoft': 'microsoft',
  'Apple': 'apple',
  'Netflix': 'netflix',
  'Bloomberg': 'bloomberg',
  'Goldman Sachs': 'goldmansachs',
  'Tcs': 'tcs',
  'Walmart Labs': 'walmart',
  'Cisco': 'cisco',
  'Salesforce': 'salesforce',
  'Oracle': 'oracle',
  'Nvidia': 'nvidia',
  'Twitter': 'x',
  'Linkedin': 'linkedin',
  'Bytedance': 'bytedance',
  'Tiktok': 'tiktok',
  'Paypal': 'paypal',
  'Stripe': 'stripe',
  'Spotify': 'spotify',
  'Airbnb': 'airbnb',
  'Atlassian': 'atlassian',
  'Dropbox': 'dropbox',
  'Pinterest': 'pinterest',
  'Snapchat': 'snapchat',
  'Lyft': 'lyft',
  'Doordash': 'doordash',
  'Instacart': 'instacart',
  'Coinbase': 'coinbase',
  'Databricks': 'databricks',
  'Snowflake': 'snowflake',
  'Palantir': 'palantir',
  'Tesla': 'tesla',
  'Intel': 'intel',
  'Amd': 'amd',
  'Qualcomm': 'qualcomm',
  'Ibm': 'ibm',
  'Samsung': 'samsung',
  'Sony': 'sony',
  'Ebay': 'ebay',
  'Shopify': 'shopify',
  'Twitch': 'twitch',
  'Reddit': 'reddit',
  'Zoom': 'zoom',
  'Square': 'square',
  'Robinhood': 'robinhood',
  'Hubspot': 'hubspot',
  'Zillow': 'zillow',
  'Yelp': 'yelp',
  'Jpmorgan': 'jpmorganchase',
  'Morgan Stanley': 'morganstanley',
  'Barclays': 'barclays',
  'Capital One': 'capitalone',
  'Visa': 'visa',
  'Mastercard': 'mastercard',
  'American Express': 'americanexpress',
  'Deutsche Bank': 'deutschebank',
  'Hsbc': 'hsbc',
  'Citadel': 'citadel',
  'Jane Street': 'janestreet',
  'Two Sigma': 'twosigma',
  'De Shaw': 'deshaw',
  'Infosys': 'infosys',
  'Wipro': 'wipro',
  'Accenture': 'accenture',
  'Cognizant': 'cognizant',
  'Capgemini': 'capgemini',
  'Zoho': 'zoho',
  'Swiggy': 'swiggy',
  'Zomato': 'zomato',
  'Flipkart': 'flipkart',
  'Paytm': 'paytm',
  'Phonepe': 'phonepe',
  'Deliveroo': 'deliveroo',
  'Grab': 'grab',
  'Canva': 'canva',
  'Figma': 'figma',
  'Notion': 'notion',
  'Discord': 'discord',
  'Github': 'github',
  'Cloudflare': 'cloudflare',
  'Mongodb': 'mongodb',
  'Postman': 'postman',
  'Asana': 'asana',
  'Servicenow': 'servicenow',
  'Splunk': 'splunk',
  'Datadog': 'datadog',
  'Rubrik': 'rubrik',
  'Cohesity': 'cohesity',
  'Palo Alto Networks': 'paloaltonetworks',
  'Fortinet': 'fortinet',
  'Crowdstrike': 'crowdstrike',
  'Nutanix': 'nutanix',
  'Vmware': 'vmware',
  'Sap': 'sap',
  'Autodesk': 'autodesk',
  'Intuit': 'intuit',
  'Workday': 'workday',
  'Roblox': 'roblox',
  'Unity': 'unity',
  'Epic Games': 'epicgames',
  'Riot Games': 'riotgames',
  'Electronic Arts': 'ea',
  'Valve': 'valve',
  'Duolingo': 'duolingo',
  'Coursera': 'coursera',
  'Udemy': 'udemy',
  'Epam Systems': 'epam',
  'Akamai': 'akamai',
  'Dell': 'dell',
  'General Motors': 'generalmotors',
  'Boeing': 'boeing',
  'Siemens': 'siemens',
  'Uber': 'uber',
  'Deepmind': 'google',
};

// High-fidelity vector SVGs for major enterprise tech brands without SimpleIcons white SVGs
const BUNDLED_SVGS: Record<string, string> = {
  microsoft: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#f25022" d="M1 1h10v10H1z"/>
  <path fill="#7fba00" d="M13 1h10v10H13z"/>
  <path fill="#00a4ef" d="M1 13h10v10H1z"/>
  <path fill="#ffb900" d="M13 13h10v10H13z"/>
</svg>`,
  amazon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#ff9900" d="M13.82 17.58c-3.1 2.29-7.61 3.5-11.51 1.76-.55-.24-.1-.85.34-.6 3.48 1.93 7.52 1.05 10.37-.62.44-.26.96.22.8.46zm1.18-1.02c-.39-.5-2.61-.24-3.62.2-.31.14-.26.48.06.48 1.05-.01 3.23.08 3.56-.68z"/>
  <path fill="#ffffff" d="M15.42 12.63c-.1-.78-.47-2.3-1.82-3.23-1.63-1.12-3.56-.9-4.52-.39-.32.17-.4.51-.15.75.25.24.57.17.89-.04.75-.48 2.05-.62 3.09.07.82.55 1.05 1.54 1.11 2.07-1.32.22-3.12.62-4.29 1.63-1.14.98-1.18 2.37-.58 3.25.64.95 1.83 1.25 2.92.85 1.15-.42 1.89-1.3 2.36-2.18.15.54.49 1.05 1.14 1.25.69.21 1.39-.06 1.76-.38.25-.22.18-.53-.11-.64-.47-.18-.75-.54-.8-1.25l-.99-1.2zm-1.42 1.57c-.15.93-.66 1.86-1.55 2.14-.64.2-1.37.03-1.69-.47-.32-.51-.18-1.32.61-1.88.75-.53 1.82-.76 2.63-.82v1.03z"/>
</svg>`,
  oracle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#f80000" d="M16.5 4H7.5C3.36 4 0 7.58 0 12s3.36 8 7.5 8h9c4.14 0 7.5-3.58 7.5-8s-3.36-8-7.5-8zm-.3 12.2H7.8c-2.3 0-4.16-1.88-4.16-4.2s1.86-4.2 4.16-4.2h8.4c2.3 0 4.16 1.88 4.16 4.2s-1.86 4.2-4.16 4.2z"/>
</svg>`,
  salesforce: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#00a1e0" d="M19.38 8.78a5.2 5.2 0 0 0-4.66-3.08 5.24 5.24 0 0 0-4.88 3.32 4.4 4.4 0 0 0-2.14-.54c-2.42 0-4.38 1.96-4.38 4.38s1.96 4.38 4.38 4.38h11.68c2.42 0 4.38-1.96 4.38-4.38 0-2.22-1.65-4.05-3.8-4.33"/>
</svg>`,
  bloomberg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#ffffff" d="M4 3h7.5c2.5 0 4.5 1.5 4.5 3.8 0 1.5-.9 2.8-2.2 3.4 1.8.6 3.2 2.1 3.2 4 0 2.6-2.2 4.3-5 4.3H4V3zm4 5.8h3c.8 0 1.5-.6 1.5-1.4s-.7-1.4-1.5-1.4H8v2.8zm0 6.6h3.4c1 0 1.8-.7 1.8-1.6s-.8-1.6-1.8-1.6H8v3.2z"/>
</svg>`,
  walmart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#ffc220" d="M12 2.5a1.5 1.5 0 0 0-1.5 1.5v4a1.5 1.5 0 0 0 3 0V4A1.5 1.5 0 0 0 12 2.5zm0 13.5a1.5 1.5 0 0 0-1.5 1.5v4a1.5 1.5 0 0 0 3 0V17.5A1.5 1.5 0 0 0 12 16zm-7.79-9.21a1.5 1.5 0 0 0-1.06 2.56l3.46 3.46a1.5 1.5 0 0 0 2.12-2.12L5.27 7.23a1.5 1.5 0 0 0-1.06-.44zm11.66 11.66a1.5 1.5 0 0 0-1.06 2.56l3.46 3.46a1.5 1.5 0 0 0 2.12-2.12l-3.46-3.46a1.5 1.5 0 0 0-1.06-.44zm-7.42 2.56a1.5 1.5 0 0 0-2.12-2.12l-3.46 3.46a1.5 1.5 0 1 0 2.12 2.12l3.46-3.46zm15.12-15.12a1.5 1.5 0 0 0-2.12 0l-3.46 3.46a1.5 1.5 0 1 0 2.12 2.12l3.46-3.46a1.5 1.5 0 0 0 0-2.12z"/>
</svg>`,
  ibm: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#052f99" d="M2 5h4v1H2zm0 2h4v1H2zm0 2h4v1H2zm0 2h4v1H2zm0 2h4v1H2zm0 2h4v1H2zm0 2h4v1H2zm7-13h6v1H9zm0 2h6v1H9zm0 2h2v1H9zm4 0h2v1h-2zm-4 2h6v1H9zm0 2h6v1H9zm0 2h2v1H9zm4 0h2v1h-2zm-4 2h6v1H9zm0 2h6v1H9zm8-13h5v1h-5zm0 2h2v1h-2zm3 0h2v1h-2zm-3 2h2v1h-2zm3 0h2v1h-2zm-3 2h5v1h-5zm0 2h5v1h-5zm0 2h2v1h-2zm3 0h2v1h-2zm-3 2h2v1h-2zm3 0h2v1h-2zm-3 2h5v1h-5z"/>
</svg>`,
  tcs: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="10" fill="#0076a8"/>
  <text x="12" y="15.5" font-size="7.5" font-weight="900" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif">TCS</text>
</svg>`,
};

function getSlug(companyName: string): string {
  if (SLUG_OVERRIDES[companyName]) {
    return SLUG_OVERRIDES[companyName];
  }
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '');
}

async function fetchSvgWithTimeout(url: string, timeoutMs: number = 3000): Promise<string | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes('<svg')) {
      return text;
    }
    return null;
  } catch {
    clearTimeout(id);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting Company Logo Ingestion Pipeline...');

  const rootDir = process.cwd();
  const companiesPath = path.join(rootDir, 'public/data/companies.json');
  const logosDir = path.join(rootDir, 'public/logos');
  const outputPath = path.join(rootDir, 'public/data/company_logos.json');

  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
  }

  // Write bundled SVGs first
  for (const [slug, svg] of Object.entries(BUNDLED_SVGS)) {
    const localFilePath = path.join(logosDir, `${slug}.svg`);
    fs.writeFileSync(localFilePath, svg.trim(), 'utf-8');
  }

  const companies: CompanyItem[] = JSON.parse(fs.readFileSync(companiesPath, 'utf-8'));
  console.log(`📋 Total companies in catalog: ${companies.length}`);

  // Sort companies by question count descending
  const sortedCompanies = [...companies].sort((a, b) => b.questionCount - a.questionCount);

  const registry: Record<string, CompanyLogoEntry> = {};
  let downloadedCount = 0;

  // We check top 150 organizations for SVGs
  const targetBatch = sortedCompanies.slice(0, 150);

  console.log(`📦 Checking/downloading vector SVGs for top ${targetBatch.length} organizations...`);

  const concurrency = 8;
  for (let i = 0; i < targetBatch.length; i += concurrency) {
    const chunk = targetBatch.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (company) => {
        const slug = getSlug(company.name);
        const localFileName = `${slug}.svg`;
        const localFilePath = path.join(logosDir, localFileName);
        const cdnUrl = `https://cdn.simpleicons.org/${slug}/white`;

        let hasLocal = false;
        if (fs.existsSync(localFilePath)) {
          hasLocal = true;
        } else {
          const svg = await fetchSvgWithTimeout(cdnUrl, 3000);
          if (svg) {
            fs.writeFileSync(localFilePath, svg, 'utf-8');
            hasLocal = true;
            downloadedCount++;
          }
        }

        registry[company.name] = {
          company: company.name,
          slug,
          localPath: hasLocal ? `/logos/${localFileName}` : null,
          cdnUrl,
        };
      })
    );
  }

  // Populate remaining companies
  for (const company of companies) {
    if (!registry[company.name]) {
      const slug = getSlug(company.name);
      const localFileName = `${slug}.svg`;
      const localFilePath = path.join(logosDir, localFileName);
      const hasLocal = fs.existsSync(localFilePath);

      registry[company.name] = {
        company: company.name,
        slug,
        localPath: hasLocal ? `/logos/${localFileName}` : null,
        cdnUrl: `https://cdn.simpleicons.org/${slug}/white`,
      };
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`✅ Saved company logos registry to ${outputPath}`);
  console.log(`✨ Total SVGs cached locally: ${fs.readdirSync(logosDir).length} (newly fetched: ${downloadedCount})`);
  console.log(`🎯 Registry covers all ${Object.keys(registry).length} companies.`);
}

main().catch((err) => {
  console.error('❌ Error executing logo pipeline:', err);
  process.exit(1);
});
