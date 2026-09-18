/**
 * /api/sync — Cross-device sync endpoint
 *
 * GET  /api/sync   — Pull server state for a user (requires auth)
 * POST /api/sync   — Push local Dexie state to server (requires auth)
 *
 * Storage backend: Supabase Postgres (configured via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * If Supabase is not configured, returns empty state (graceful degradation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { ServerSyncPayload } from '@/lib/sync';
import type { UserProgress, UserCode, Sprint } from '@/lib/db';
import { isClerkConfigured } from '@/lib/auth/clerkConfig';
import { checkRateLimit } from '@/lib/rateLimit';

const MAX_SYNC_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

// Supabase client — lazily initialized to avoid build errors when env vars not set
let supabase: any = null;

async function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(url, key);
    return supabase;
  } catch {
    return null;
  }
}

// ── Mappings: Dexie camelCase <-> Postgres snake_case ───────────────────────

function progressToRow(p: UserProgress, userId: string) {
  return {
    user_id: userId,
    problem_id: String(p.problemId),
    status: p.status,
    revisions: p.revisions ?? 0,
    ease_factor: p.easeFactor ?? 2.5,
    interval_days: p.intervalDays ?? 0,
    next_review_date: p.nextReviewDate,
    last_solved: p.lastSolved ?? null,
  };
}

function codeToRow(c: UserCode, userId: string) {
  return {
    user_id: userId,
    id: c.id || `${c.problemId}_${c.language}`,
    problem_id: String(c.problemId),
    language: c.language,
    code: c.code,
    notes: c.notes ?? null,
    updated_at: c.updatedAt,
  };
}

function sprintToRow(s: Sprint, userId: string) {
  return {
    user_id: userId,
    date: s.date,
    duration_minutes: s.durationMinutes,
    completed_count: s.completedCount ?? 0,
    problem_ids: s.problemIds ?? [],
  };
}

function rowToProgress(row: any): UserProgress {
  return {
    problemId: row.problem_id,
    status: row.status,
    revisions: row.revisions ?? 0,
    easeFactor: row.ease_factor !== undefined ? Number(row.ease_factor) : 2.5,
    intervalDays: row.interval_days ?? 0,
    nextReviewDate: row.next_review_date,
    lastSolved: row.last_solved ?? undefined,
  };
}

function rowToCode(row: any): UserCode {
  return {
    id: row.id,
    problemId: row.problem_id,
    language: row.language,
    code: row.code,
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at,
  };
}

function rowToSprint(row: any): Sprint {
  return {
    id: row.id !== undefined ? Number(row.id) : undefined,
    date: row.date,
    durationMinutes: row.duration_minutes,
    completedCount: row.completed_count ?? 0,
    problemIds: row.problem_ids ?? [],
  };
}

// GET — pull server state
export async function GET(req: NextRequest) {
  if (!isClerkConfigured()) {
    return NextResponse.json({ error: 'Authentication not configured' }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfterMs } = checkRateLimit(`sync:${userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const sb = await getSupabase();
  if (!sb) {
    // Supabase not configured — return empty state (offline-first graceful degradation)
    return NextResponse.json({
      userProgress: [],
      userCode: [],
      sprints: [],
      syncedAt: new Date().toISOString(),
    } satisfies ServerSyncPayload);
  }

  const [{ data: progress }, { data: code }, { data: sprints }] = await Promise.all([
    sb.from('user_progress').select('*').eq('user_id', userId),
    sb.from('user_code').select('*').eq('user_id', userId),
    sb.from('sprints').select('*').eq('user_id', userId),
  ]);

  return NextResponse.json({
    userProgress: (progress || []).map(rowToProgress),
    userCode: (code || []).map(rowToCode),
    sprints: (sprints || []).map(rowToSprint),
    syncedAt: new Date().toISOString(),
  } satisfies ServerSyncPayload);
}

// POST — push local state
export async function POST(req: NextRequest) {
  if (!isClerkConfigured()) {
    return NextResponse.json({ error: 'Authentication not configured' }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfterMs } = checkRateLimit(`sync:${userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  // Validate payload size before parsing
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_SYNC_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large (max 2 MB).' }, { status: 413 });
  }

  const bodyText = await req.text();
  if (bodyText.length > MAX_SYNC_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large (max 2 MB).' }, { status: 413 });
  }

  let body: ServerSyncPayload;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const sb = await getSupabase();

  if (!sb) {
    // Graceful degradation when Supabase not configured
    return NextResponse.json({ ok: true, synced: 0 });
  }

  // Map to snake_case schema rows
  const progressRows = (body.userProgress || []).map((p) => progressToRow(p, userId));
  const codeRows = (body.userCode || []).map((c) => codeToRow(c, userId));
  const sprintRows = (body.sprints || []).map((s) => sprintToRow(s, userId));

  // Avoid duplicate sprints
  let sprintsToInsert = sprintRows;
  if (sprintRows.length > 0) {
    const { data: existingSprints } = await sb
      .from('sprints')
      .select('date, duration_minutes')
      .eq('user_id', userId);

    const existingSet = new Set(
      (existingSprints || []).map((s: any) => `${s.date}_${s.duration_minutes}`)
    );

    sprintsToInsert = sprintRows.filter(
      (s) => !existingSet.has(`${s.date}_${s.duration_minutes}`)
    );
  }

  await Promise.all([
    progressRows.length
      ? sb.from('user_progress').upsert(progressRows, { onConflict: 'user_id,problem_id' })
      : Promise.resolve(),
    codeRows.length
      ? sb.from('user_code').upsert(codeRows, { onConflict: 'user_id,id' })
      : Promise.resolve(),
    sprintsToInsert.length
      ? sb.from('sprints').insert(sprintsToInsert)
      : Promise.resolve(),
  ]);

  return NextResponse.json({
    ok: true,
    synced: progressRows.length + codeRows.length + sprintsToInsert.length,
  });
}
