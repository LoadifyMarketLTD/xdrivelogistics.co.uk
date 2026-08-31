BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Hosted production carries these job audit markers but the clean migration
-- chain omitted them before P0-08 first use. Reconstruct only the observed
-- physical contracts needed by this reconciliation.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

DO $$
DECLARE
  v_is_test_nullable text;
  v_is_test_default text;
  v_cancel_type text;
  v_cancel_nullable text;
  v_cancel_default text;
BEGIN
  SELECT c.is_nullable, c.column_default
  INTO v_is_test_nullable, v_is_test_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'jobs'
    AND c.column_name = 'is_test';

  IF v_is_test_nullable IS DISTINCT FROM 'NO'
     OR v_is_test_default IS NULL
     OR lower(v_is_test_default) NOT LIKE '%false%' THEN
    RAISE EXCEPTION 'jobs.is_test clean-replay contract is not BOOLEAN NOT NULL DEFAULT false.';
  END IF;

  SELECT c.data_type, c.is_nullable, c.column_default
  INTO v_cancel_type, v_cancel_nullable, v_cancel_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'jobs'
    AND c.column_name = 'cancellation_reason';

  IF v_cancel_type IS DISTINCT FROM 'text'
     OR v_cancel_nullable IS DISTINCT FROM 'YES'
     OR v_cancel_default IS NOT NULL THEN
    RAISE EXCEPTION 'jobs.cancellation_reason clean-replay contract is not nullable TEXT without a default.';
  END IF;
END;
$$;

-- Hosted production still carries an empty legacy proof_of_delivery table, but
-- the canonical repository/runtime no longer reconstructs or writes that table.
-- Preserve the historical safety check only where the legacy table exists,
-- without recreating retired schema solely to make this migration parse.
CREATE OR REPLACE FUNCTION public.p0_proof_of_delivery_dependency_exists(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists boolean := false;
BEGIN
  IF to_regclass('public.proof_of_delivery') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.proof_of_delivery p WHERE p.job_id = $1)'
    INTO v_exists
    USING p_job_id;

  RETURN COALESCE(v_exists, false);
END;
$$;

REVOKE ALL ON FUNCTION public.p0_proof_of_delivery_dependency_exists(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.p0_proof_of_delivery_dependency_exists(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.p0_proof_of_delivery_dependency_exists(uuid) FROM authenticated;

-- P0-08: historical award/assignment data must never coexist with an open,
-- pre-award job lifecycle. Preserve the two known historical test awards as
-- cancelled audit history rather than pretending they are still Marketplace work.
WITH reconciled AS (
  UPDATE public.jobs j
  SET status = 'cancelled',
      current_status = 'cancelled',
      cancellation_reason = COALESCE(
        NULLIF(btrim(j.cancellation_reason), ''),
        'Historical test fixture reconciled: accepted/assigned award data could not remain in posted lifecycle.'
      ),
      status_history = COALESCE(j.status_history, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'status', 'cancelled',
          'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'reason', 'Historical test fixture award/lifecycle reconciliation'
        )),
      updated_at = now()
  WHERE COALESCE(j.is_test, false) = true
    AND lower(COALESCE(j.status, '')) IN ('draft', 'open', 'received', 'posted', 'quoted')
    AND lower(COALESCE(j.current_status, j.status, '')) IN ('draft', 'open', 'received', 'posted', 'quoted')
    AND j.accepted_bid_id IS NOT NULL
    AND j.awarded_carrier_company_id IS NOT NULL
    AND j.assigned_company_id IS NOT NULL
    AND j.assigned_company_id = j.awarded_carrier_company_id
    AND j.assigned_driver_id IS NOT NULL
    AND j.pickup_datetime < now()
    AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.job_id = j.id)
    AND NOT public.p0_proof_of_delivery_dependency_exists(j.id)
  RETURNING j.id, j.created_by
)
INSERT INTO public.job_tracking_events (
  job_id,
  event_type,
  created_by,
  message,
  meta
)
SELECT
  r.id,
  'cancelled',
  r.created_by,
  'Historical test fixture reconciled from impossible posted+awarded state.',
  jsonb_build_object(
    'reason', 'award_lifecycle_reconciliation',
    'migration', '20260830192000_reconcile_job_award_lifecycle_integrity'
  )
FROM reconciled r;

DROP FUNCTION IF EXISTS public.p0_proof_of_delivery_dependency_exists(uuid);

-- Database invariant: award/assignment authority cannot exist while the job is
-- still in a pre-award/open lifecycle. Direct invites use direct_invite_company_id
-- and are intentionally not blocked by this rule until actually awarded/allocated.
CREATE OR REPLACE FUNCTION public.guard_job_award_lifecycle_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := lower(btrim(COALESCE(NEW.status, '')));
  v_current_status text := lower(btrim(COALESCE(NEW.current_status, NEW.status, '')));
  v_has_award_authority boolean :=
    NEW.accepted_bid_id IS NOT NULL
    OR NEW.awarded_carrier_company_id IS NOT NULL
    OR NEW.assigned_company_id IS NOT NULL
    OR NEW.assigned_driver_id IS NOT NULL;
BEGIN
  IF v_has_award_authority
     AND (
       v_status IN ('draft', 'open', 'received', 'posted', 'quoted')
       OR v_current_status IN ('draft', 'open', 'received', 'posted', 'quoted')
     ) THEN
    RAISE EXCEPTION
      'Award/assignment authority cannot coexist with pre-award job lifecycle (% / %).',
      NEW.status,
      NEW.current_status
      USING ERRCODE = '23514';
  END IF;

  IF NEW.accepted_bid_id IS NOT NULL
     AND NEW.awarded_carrier_company_id IS NULL THEN
    RAISE EXCEPTION 'An accepted bid requires an awarded carrier company.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.awarded_carrier_company_id IS NOT NULL
     AND NEW.assigned_company_id IS DISTINCT FROM NEW.awarded_carrier_company_id THEN
    RAISE EXCEPTION 'Assigned company must match the awarded carrier company.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.assigned_driver_id IS NOT NULL
     AND NEW.assigned_company_id IS NULL THEN
    RAISE EXCEPTION 'An assigned Driver requires an assigned company.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_job_award_lifecycle_consistency() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_job_award_lifecycle_consistency() FROM anon;
REVOKE ALL ON FUNCTION public.guard_job_award_lifecycle_consistency() FROM authenticated;

DROP TRIGGER IF EXISTS trg_guard_job_award_lifecycle_consistency ON public.jobs;
CREATE TRIGGER trg_guard_job_award_lifecycle_consistency
BEFORE INSERT OR UPDATE OF
  status,
  current_status,
  accepted_bid_id,
  awarded_carrier_company_id,
  assigned_company_id,
  assigned_driver_id
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.guard_job_award_lifecycle_consistency();

DO $$
DECLARE
  v_invalid_preaward integer;
  v_accepted_without_carrier integer;
  v_carrier_assignment_mismatch integer;
  v_driver_without_company integer;
BEGIN
  SELECT count(*) INTO v_invalid_preaward
  FROM public.jobs j
  WHERE (
      j.accepted_bid_id IS NOT NULL
      OR j.awarded_carrier_company_id IS NOT NULL
      OR j.assigned_company_id IS NOT NULL
      OR j.assigned_driver_id IS NOT NULL
    )
    AND (
      lower(COALESCE(j.status, '')) IN ('draft', 'open', 'received', 'posted', 'quoted')
      OR lower(COALESCE(j.current_status, j.status, '')) IN ('draft', 'open', 'received', 'posted', 'quoted')
    );

  SELECT count(*) INTO v_accepted_without_carrier
  FROM public.jobs
  WHERE accepted_bid_id IS NOT NULL
    AND awarded_carrier_company_id IS NULL;

  SELECT count(*) INTO v_carrier_assignment_mismatch
  FROM public.jobs
  WHERE awarded_carrier_company_id IS NOT NULL
    AND assigned_company_id IS DISTINCT FROM awarded_carrier_company_id;

  SELECT count(*) INTO v_driver_without_company
  FROM public.jobs
  WHERE assigned_driver_id IS NOT NULL
    AND assigned_company_id IS NULL;

  IF v_invalid_preaward <> 0
     OR v_accepted_without_carrier <> 0
     OR v_carrier_assignment_mismatch <> 0
     OR v_driver_without_company <> 0 THEN
    RAISE EXCEPTION
      'Job award lifecycle invariant failed: preaward=%, accepted_without_carrier=%, carrier_mismatch=%, driver_without_company=%',
      v_invalid_preaward,
      v_accepted_without_carrier,
      v_carrier_assignment_mismatch,
      v_driver_without_company;
  END IF;
END;
$$;

COMMIT;
