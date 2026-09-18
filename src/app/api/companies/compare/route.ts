import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

interface ProblemMeta {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  problemType: string;
  corePattern: string;
  learningTrack: string;
  companiesCount: number;
  avgAcceptance: number;
  priorityBucket: string;
}

interface Mapping {
  company: string;
  problemId: string;
  frequencyPct: number;
}

let cachedMetadata: ProblemMeta[] | null = null;
let cachedMappings: Mapping[] | null = null;

function loadServerData() {
  if (!cachedMetadata) {
    const metaPath = path.join(process.cwd(), "public/data/problems_metadata.json");
    if (fs.existsSync(metaPath)) {
      cachedMetadata = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    } else {
      const probPath = path.join(process.cwd(), "public/data/problems.json");
      const probs = JSON.parse(fs.readFileSync(probPath, "utf-8"));
      cachedMetadata = probs.map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        difficulty: p.difficulty,
        problemType: p.problemType,
        corePattern: p.corePattern,
        learningTrack: p.learningTrack,
        companiesCount: p.companiesCount,
        avgAcceptance: p.avgAcceptance,
        priorityBucket: p.priorityBucket,
      }));
    }
  }

  if (!cachedMappings) {
    const mapPath = path.join(process.cwd(), "public/data/company_mappings.json");
    cachedMappings = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
  }

  return { metadata: cachedMetadata!, mappings: cachedMappings! };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companiesRaw = searchParams.get("companies");
  const mode = searchParams.get("mode") || "intersection";
  const track = searchParams.get("track") || "All";

  if (!companiesRaw) {
    return NextResponse.json({ error: "Missing companies query param" }, { status: 400 });
  }

  const selectedCompanies = companiesRaw
    .split(",")
    .map((c) => decodeURIComponent(c.trim()))
    .filter(Boolean);

  if (selectedCompanies.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  const { metadata, mappings } = loadServerData();

  const pMap = new Map<string, ProblemMeta>();
  metadata.forEach((p) => pMap.set(p.id, p));

  const cfMap = new Map<string, Map<string, number>>();
  mappings.forEach((m) => {
    let map = cfMap.get(m.company);
    if (!map) {
      map = new Map<string, number>();
      cfMap.set(m.company, map);
    }
    map.set(m.problemId, m.frequencyPct);
  });

  const problemIds = new Set<string>();
  selectedCompanies.forEach((company) => {
    const map = cfMap.get(company);
    if (map) {
      map.forEach((_, pid) => problemIds.add(pid));
    }
  });

  const rows: any[] = [];
  problemIds.forEach((pid) => {
    const p = pMap.get(pid);
    if (!p) return;
    if (track !== "All" && p.learningTrack !== track) return;

    const frequencies: Record<string, number> = {};
    let matchCount = 0;
    let totalScore = 0;

    selectedCompanies.forEach((company) => {
      const freq = cfMap.get(company)?.get(pid) || 0;
      frequencies[company] = freq;
      if (freq > 0) {
        matchCount++;
        totalScore += freq;
      }
    });

    if (mode === "intersection") {
      if (matchCount === selectedCompanies.length) {
        rows.push({ problem: p, companyFrequencies: frequencies, totalScore, matchCount });
      }
    } else {
      rows.push({ problem: p, companyFrequencies: frequencies, totalScore, matchCount });
    }
  });

  rows.sort((a, b) => b.totalScore - a.totalScore);
  return NextResponse.json({ rows });
}
