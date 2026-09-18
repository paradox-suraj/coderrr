-- AlgoJeet Pro — Migration 002: Audit Columns + Maintenance
-- Run with: supabase db push  OR  paste into the Supabase SQL editor.

-- ── Add created_at audit column to all tables ─────────────────────────────
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

ALTER TABLE public.user_code
  ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

ALTER TABLE public.sprints
  ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

-- ── Enable pg_cron extension (Supabase Pro only) ───────────────────────────
-- On Free tier: skip the cron job — Supabase runs daily pg_dump backups automatically.
-- On Pro tier: uncomment the lines below.

-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- -- Weekly VACUUM ANALYZE on Sunday at 03:00 UTC
-- SELECT cron.schedule(
--   'weekly-vacuum-analyze',
--   '0 3 * * 0',
--   $$VACUUM ANALYZE public.user_progress; VACUUM ANALYZE public.user_code; VACUUM ANALYZE public.sprints;$$
-- );

-- ── Useful indexes for future queries ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_progress_status ON public.user_progress (user_id, status);
CREATE INDEX IF NOT EXISTS idx_code_updated ON public.user_code (user_id, updated_at DESC);
