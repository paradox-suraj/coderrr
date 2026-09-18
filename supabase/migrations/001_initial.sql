-- AlgoJeet Pro — Supabase Schema
-- Mirrors the Dexie v3 IndexedDB schema for cross-device sync.
-- Run with: supabase db push  OR  execute in Supabase SQL editor.

-- ── user_progress ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id         TEXT        NOT NULL,
  problem_id      TEXT        NOT NULL,
  status          TEXT        NOT NULL CHECK (status IN ('unsolved', 'attempted', 'solved')),
  revisions       INTEGER     NOT NULL DEFAULT 0,
  ease_factor     NUMERIC     NOT NULL DEFAULT 2.5,
  interval_days   INTEGER     NOT NULL DEFAULT 0,
  next_review_date TEXT,               -- ISO 8601 string (matches Dexie field exactly)
  last_solved     TEXT,                -- ISO 8601 string
  PRIMARY KEY (user_id, problem_id)
);

-- Camel-case view so the sync layer can map directly to/from TypeScript interfaces
CREATE OR REPLACE VIEW public.user_progress_view AS
  SELECT
    user_id                         AS "userId",
    problem_id                      AS "problemId",
    status,
    revisions,
    ease_factor                     AS "easeFactor",
    interval_days                   AS "intervalDays",
    next_review_date                AS "nextReviewDate",
    last_solved                     AS "lastSolved"
  FROM public.user_progress;

-- ── user_code ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_code (
  user_id     TEXT    NOT NULL,
  id          TEXT    NOT NULL,    -- composite key: `${problemId}_${language}`
  problem_id  TEXT    NOT NULL,
  language    TEXT    NOT NULL CHECK (language IN ('python', 'cpp', 'java', 'javascript')),
  code        TEXT    NOT NULL,
  notes       TEXT,
  updated_at  TEXT    NOT NULL,   -- ISO 8601 string
  PRIMARY KEY (user_id, id)
);

-- ── sprints ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sprints (
  id                  BIGSERIAL   PRIMARY KEY,
  user_id             TEXT        NOT NULL,
  date                TEXT        NOT NULL,   -- YYYY-MM-DD
  duration_minutes    INTEGER     NOT NULL,
  completed_count     INTEGER     NOT NULL DEFAULT 0,
  problem_ids         TEXT[]      NOT NULL DEFAULT '{}'
);

-- ── RLS Policies (enable Row Level Security) ──────────────────────────────
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_code     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints       ENABLE ROW LEVEL SECURITY;

-- Service role key bypasses RLS — used server-side only (never exposed to client)
-- Client-side anon key would need these policies:
-- CREATE POLICY "Users can read own progress" ON public.user_progress
--   FOR SELECT USING (auth.uid()::text = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_progress_user ON public.user_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_progress_review ON public.user_progress (user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_code_user ON public.user_code (user_id);
CREATE INDEX IF NOT EXISTS idx_code_problem ON public.user_code (user_id, problem_id);
CREATE INDEX IF NOT EXISTS idx_sprints_user ON public.sprints (user_id, date);
