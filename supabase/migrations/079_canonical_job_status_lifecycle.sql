-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 079 — Canonical job-status lifecycle
-- Adds missing enum values and rewrites the transition-guard trigger to enforce
-- the full canonical chain:
--   draft → posted → quoted → awarded → allocated → collected
--        → in_transit → delivered → invoiced → paid
-- Terminal states: paid, cancelled, disputed
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extend public.job_status enum ─────────────────────────────────────────
DO $$
BEGIN
  -- quoted
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'quoted'
      AND enumtypid = 'public.job_status'::regtype
  ) THEN
    ALTER TYPE public.job_status ADD VALUE 'quoted';
  END IF;

  -- awarded
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'awarded'
      AND enumtypid = 'public.job_status'::regtype
  ) THEN
    ALTER TYPE public.job_status ADD VALUE 'awarded';
  END IF;

  -- collected
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'collected'
      AND enumtypid = 'public.job_status'::regtype
  ) THEN
    ALTER TYPE public.job_status ADD VALUE 'collected';
  END IF;

  -- invoiced
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'invoiced'
      AND enumtypid = 'public.job_status'::regtype
  ) THEN
    ALTER TYPE public.job_status ADD VALUE 'invoiced';
  END IF;

  -- paid
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'paid'
      AND enumtypid = 'public.job_status'::regtype
  ) THEN
    ALTER TYPE public.job_status ADD VALUE 'paid';
  END IF;
END $$;

-- ── 2. Replace transition-guard trigger with full canonical chain ─────────────
-- Drop old trigger first so we can redefine the function cleanly.
DROP TRIGGER IF EXISTS trg_validate_job_status_transition ON public.jobs;

CREATE OR REPLACE FUNCTION public.validate_job_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_allowed_next text[];
BEGIN
  -- Only enforce when status actually changes
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_allowed_next := CASE OLD.status::text
    WHEN 'draft'      THEN ARRAY['posted', 'cancelled', 'disputed']
    WHEN 'posted'     THEN ARRAY['quoted', 'allocated', 'cancelled', 'disputed']
    WHEN 'quoted'     THEN ARRAY['awarded', 'posted', 'cancelled', 'disputed']
    WHEN 'awarded'    THEN ARRAY['allocated', 'cancelled', 'disputed']
    WHEN 'allocated'  THEN ARRAY['collected', 'in_transit', 'cancelled', 'disputed']
    WHEN 'collected'  THEN ARRAY['in_transit', 'cancelled', 'disputed']
    WHEN 'in_transit' THEN ARRAY['delivered', 'cancelled', 'disputed']
    WHEN 'delivered'  THEN ARRAY['invoiced']
    WHEN 'invoiced'   THEN ARRAY['paid']
    -- terminal states
    WHEN 'paid'       THEN ARRAY[]::text[]
    WHEN 'cancelled'  THEN ARRAY[]::text[]
    WHEN 'disputed'   THEN ARRAY[]::text[]
    ELSE                   ARRAY[]::text[]
  END;

  IF NOT (NEW.status::text = ANY(v_allowed_next)) THEN
    RAISE EXCEPTION
      'Invalid job status transition: % → % (allowed: %)',
      OLD.status, NEW.status, array_to_string(v_allowed_next, ', ');
  END IF;

  -- Compliance guard: collected/in_transit requires an assigned driver
  IF NEW.status::text IN ('collected', 'in_transit', 'delivered') THEN
    IF NEW.assigned_driver_id IS NULL THEN
      RAISE EXCEPTION
        'Job cannot move to % without an assigned driver.', NEW.status;
    END IF;
  END IF;

  -- POD guard: delivered requires at least one delivery photo or signature
  IF NEW.status::text = 'delivered' THEN
    IF (NEW.delivery_photos IS NULL OR jsonb_array_length(to_jsonb(NEW.delivery_photos)) = 0)
       AND (NEW.delivery_signature_data IS NULL OR NEW.delivery_signature_data = '') THEN
      RAISE EXCEPTION
        'Job cannot be marked delivered without a delivery photo or signature.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_job_status_transition
  BEFORE UPDATE OF status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_job_status_transition();
