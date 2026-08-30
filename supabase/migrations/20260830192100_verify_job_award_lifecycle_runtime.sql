BEGIN;

-- P0-08 production proof. Use an existing marked test job and deliberately roll
-- back the invalid mutation inside an exception subtransaction.
DO $$
DECLARE
  v_job_id uuid;
  v_original_status text;
  v_original_current_status text;
  v_original_awarded_company_id uuid;
  v_probe_company_id uuid;
  v_rejected boolean := false;
BEGIN
  SELECT j.id, j.status, j.current_status, j.awarded_carrier_company_id
  INTO v_job_id, v_original_status, v_original_current_status, v_original_awarded_company_id
  FROM public.jobs j
  WHERE COALESCE(j.is_test, false) = true
    AND lower(COALESCE(j.status, '')) = 'posted'
    AND j.awarded_carrier_company_id IS NULL
    AND j.assigned_company_id IS NULL
    AND j.assigned_driver_id IS NULL
  ORDER BY j.created_at
  LIMIT 1;

  SELECT c.id
  INTO v_probe_company_id
  FROM public.companies c
  WHERE c.status::text = 'active'
  ORDER BY c.created_at
  LIMIT 1;

  IF v_job_id IS NULL OR v_probe_company_id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    UPDATE public.jobs
    SET awarded_carrier_company_id = v_probe_company_id,
        assigned_company_id = v_probe_company_id,
        updated_at = now()
    WHERE id = v_job_id;
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Pre-award job accepted award authority without lifecycle transition.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = v_job_id
      AND j.status IS NOT DISTINCT FROM v_original_status
      AND j.current_status IS NOT DISTINCT FROM v_original_current_status
      AND j.awarded_carrier_company_id IS NOT DISTINCT FROM v_original_awarded_company_id
      AND j.assigned_company_id IS NULL
      AND j.assigned_driver_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Rejected award/lifecycle probe changed the test job.';
  END IF;

  IF EXISTS (
    SELECT 1
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
      )
  ) THEN
    RAISE EXCEPTION 'Runtime proof finished with award authority in pre-award lifecycle.';
  END IF;
END;
$$;

COMMIT;
