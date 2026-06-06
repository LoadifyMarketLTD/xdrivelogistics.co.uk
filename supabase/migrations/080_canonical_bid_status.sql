-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 080 — Canonical bid status
-- Backfills 'pending' → 'submitted', sets DEFAULT 'submitted',
-- and adds a CHECK constraint to enforce valid bid statuses.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Backfill: treat any 'pending' bid as 'submitted' ──────────────────────
UPDATE public.job_bids
SET    status = 'submitted'
WHERE  status = 'pending';

-- ── 2. Drop any pre-existing check constraint on status ─────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'public.job_bids'::regclass
      AND  contype  = 'c'
      AND  conname  LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.job_bids DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- ── 3. Add canonical CHECK constraint ────────────────────────────────────────
ALTER TABLE public.job_bids
  ADD CONSTRAINT job_bids_status_canonical
  CHECK (status IN ('submitted', 'accepted', 'rejected', 'withdrawn'));

-- ── 4. Set canonical DEFAULT ──────────────────────────────────────────────────
ALTER TABLE public.job_bids
  ALTER COLUMN status SET DEFAULT 'submitted';

-- ── 5. Ensure NOT NULL ────────────────────────────────────────────────────────
ALTER TABLE public.job_bids
  ALTER COLUMN status SET NOT NULL;
