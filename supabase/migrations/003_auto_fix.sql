-- ============================================================
-- XDrive Logistics LTD — Auto-Fix / Migration
-- Safe, idempotent. Run AFTER 002_health_check.sql.
-- Adds only what is missing; never drops or renames existing data.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────
-- A) PROFILES — add missing columns
-- ──────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS role       text DEFAULT 'viewer',
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────
-- B) COMPANIES — add missing columns
-- ──────────────────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status       text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS company_type text DEFAULT 'standard';

-- ──────────────────────────────────────────────
-- C) COMPANY_MEMBERSHIPS — ensure UNIQUE constraint
--    (already in 001, but guard for environments
--     where 001 was applied partially)
-- ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema    = ccu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema    = 'public'
      AND tc.table_name      = 'company_memberships'
      AND ccu.column_name    = 'user_id'
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_company_id_user_id_key
      UNIQUE (company_id, user_id);
  END IF;
END
$$;

-- ──────────────────────────────────────────────
-- D) JOBS — add missing columns
-- ──────────────────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS distance_to_pickup_miles numeric;

-- ──────────────────────────────────────────────
-- E) JOB_DOCUMENTS — ensure created_at exists
--    (guard for environments missing the column)
-- ──────────────────────────────────────────────
ALTER TABLE public.job_documents
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ──────────────────────────────────────────────
-- F) JOB_NOTES — create if missing
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  note        text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_notes_job_id_idx
  ON public.job_notes (job_id);

CREATE INDEX IF NOT EXISTS job_notes_company_id_idx
  ON public.job_notes (company_id);

-- ──────────────────────────────────────────────
-- G) JOB_BIDS — add bid_price_gbp and bidder_id
--    as aliases so either naming convention works
-- ──────────────────────────────────────────────
ALTER TABLE public.job_bids
  ADD COLUMN IF NOT EXISTS bid_price_gbp numeric(12,2),
  ADD COLUMN IF NOT EXISTS bidder_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill bid_price_gbp from amount for existing rows
UPDATE public.job_bids
SET bid_price_gbp = amount
WHERE bid_price_gbp IS NULL AND amount IS NOT NULL;

-- Backfill bidder_id from bidder_user_id for existing rows
UPDATE public.job_bids
SET bidder_id = bidder_user_id
WHERE bidder_id IS NULL AND bidder_user_id IS NOT NULL;

-- Trigger: keep bid_price_gbp and amount in sync on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.sync_job_bid_price()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- If both are provided but differ, bid_price_gbp takes precedence for clarity
  IF NEW.bid_price_gbp IS NOT NULL AND NEW.amount IS NOT NULL
     AND NEW.bid_price_gbp <> NEW.amount THEN
    RAISE WARNING 'job_bids: bid_price_gbp (%) and amount (%) differ — using bid_price_gbp',
                  NEW.bid_price_gbp, NEW.amount;
    NEW.amount := NEW.bid_price_gbp;
  END IF;
  -- If only amount is provided, copy to bid_price_gbp
  IF NEW.bid_price_gbp IS NULL AND NEW.amount IS NOT NULL THEN
    NEW.bid_price_gbp := NEW.amount;
  END IF;
  -- If only bid_price_gbp is provided, copy to amount
  IF NEW.amount IS NULL AND NEW.bid_price_gbp IS NOT NULL THEN
    NEW.amount := NEW.bid_price_gbp;
  END IF;
  -- If both bidder fields are provided but differ, bidder_user_id takes precedence
  IF NEW.bidder_id IS NOT NULL AND NEW.bidder_user_id IS NOT NULL
     AND NEW.bidder_id <> NEW.bidder_user_id THEN
    RAISE WARNING 'job_bids: bidder_id (%) and bidder_user_id (%) differ — using bidder_user_id',
                  NEW.bidder_id, NEW.bidder_user_id;
    NEW.bidder_id := NEW.bidder_user_id;
  END IF;
  -- If only bidder_user_id is provided, copy to bidder_id
  IF NEW.bidder_id IS NULL AND NEW.bidder_user_id IS NOT NULL THEN
    NEW.bidder_id := NEW.bidder_user_id;
  END IF;
  -- If only bidder_id is provided, copy to bidder_user_id
  IF NEW.bidder_user_id IS NULL AND NEW.bidder_id IS NOT NULL THEN
    NEW.bidder_user_id := NEW.bidder_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_bid_price ON public.job_bids;
CREATE TRIGGER trg_sync_job_bid_price
  BEFORE INSERT OR UPDATE ON public.job_bids
  FOR EACH ROW EXECUTE FUNCTION public.sync_job_bid_price();

CREATE INDEX IF NOT EXISTS job_bids_job_id_idx
  ON public.job_bids (job_id);

CREATE INDEX IF NOT EXISTS job_bids_company_id_idx
  ON public.job_bids (company_id);

CREATE INDEX IF NOT EXISTS job_bids_bidder_id_idx
  ON public.job_bids (bidder_id);

-- ──────────────────────────────────────────────
-- H) DRIVER_LOCATIONS — add missing columns
-- ──────────────────────────────────────────────
ALTER TABLE public.driver_locations
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ──────────────────────────────────────────────
-- I) RETURN_JOURNEYS — add missing status column
-- ──────────────────────────────────────────────
ALTER TABLE public.return_journeys
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';

-- ──────────────────────────────────────────────
-- J) ENABLE RLS on new table
-- ──────────────────────────────────────────────
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- K) RLS POLICIES — job_notes
-- ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'job_notes'
      AND policyname = 'job_notes_all_member'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "job_notes_all_member"
        ON public.job_notes FOR ALL
        USING (public.is_company_member(company_id))
    $policy$;
  END IF;
END
$$;

-- ──────────────────────────────────────────────
-- L) INDEXES on existing tables (idempotent)
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS jobs_company_id_idx
  ON public.jobs (company_id);

CREATE INDEX IF NOT EXISTS jobs_status_idx
  ON public.jobs (status);

CREATE INDEX IF NOT EXISTS jobs_created_at_idx
  ON public.jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS job_tracking_events_job_id_idx
  ON public.job_tracking_events (job_id);

CREATE INDEX IF NOT EXISTS driver_locations_driver_id_idx
  ON public.driver_locations (driver_id);

COMMIT;
