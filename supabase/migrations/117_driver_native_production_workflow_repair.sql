-- Migration 117: Native driver production workflow repair.
--
-- Fixes:
-- 1. PostgREST jobs -> companies embed ambiguity by keeping the canonical
--    jobs_company_id_fkey relation available and named.
-- 2. Driver assignment is idempotent when a job already has the requested
--    assigned_driver_id. The UI must not be forced to assign the same driver
--    twice after bid award.
-- 3. Bid award persists assigned_company_id/current_status for the awarded
--    carrier path so the native driver app can receive the job directly.

BEGIN;

DO $$
DECLARE
  v_constraint text;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.contype = 'f'
      AND con.conrelid = 'public.jobs'::regclass
      AND con.confrelid = 'public.companies'::regclass
      AND con.conname <> 'jobs_company_id_fkey'
  LOOP
    EXECUTE format('ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS %I', v_constraint);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_company_id_fkey'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assign_job_driver_atomic(
  p_job_id uuid,
  p_driver_id uuid,
  p_expected_assigned_driver_id uuid,
  p_actor_user_id uuid
)
RETURNS TABLE (
  job_id uuid,
  status text,
  current_status text,
  assigned_driver_id uuid,
  assigned_company_id uuid,
  awarded_carrier_company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_allowed_company_id uuid;
  v_role text;
  v_driver_status text;
  v_next_status text;
  v_note text;
BEGIN
  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.assigned_driver_id IS NOT NULL
     AND v_job.assigned_driver_id IS NOT DISTINCT FROM p_driver_id
     AND p_expected_assigned_driver_id IS NOT NULL
     AND v_job.assigned_driver_id IS NOT DISTINCT FROM p_expected_assigned_driver_id THEN
    RETURN QUERY
    SELECT j.id, j.status::text, j.current_status::text, j.assigned_driver_id, j.assigned_company_id, j.awarded_carrier_company_id
    FROM public.jobs j
    WHERE j.id = p_job_id;
    RETURN;
  END IF;

  IF v_job.assigned_driver_id IS DISTINCT FROM p_expected_assigned_driver_id THEN
    RAISE EXCEPTION 'Job assignment changed while this request was in progress.' USING ERRCODE = '40001';
  END IF;

  v_allowed_company_id := COALESCE(v_job.awarded_carrier_company_id, v_job.company_id);

  SELECT cm.role_in_company
  INTO v_role
  FROM public.company_memberships cm
  WHERE cm.company_id = v_allowed_company_id
    AND cm.user_id = p_actor_user_id
    AND cm.status = 'active'
  LIMIT 1;

  IF v_role NOT IN ('owner', 'admin', 'dispatcher') THEN
    IF v_job.awarded_carrier_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only an operator of the awarded carrier can assign a driver after award.' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'Only an operator of the job owner company can assign a driver before award.' USING ERRCODE = '42501';
  END IF;

  IF p_driver_id IS NOT NULL THEN
    SELECT d.status
    INTO v_driver_status
    FROM public.drivers d
    WHERE d.id = p_driver_id
      AND d.company_id = v_allowed_company_id
    FOR UPDATE;

    IF v_driver_status IS NULL OR v_driver_status IN ('suspended', 'inactive', 'rejected') THEN
      RAISE EXCEPTION 'Driver is not active in the assignable company.' USING ERRCODE = '23514';
    END IF;
  END IF;

  v_next_status := v_job.status;
  IF p_driver_id IS NOT NULL AND lower(coalesce(v_job.status::text, '')) IN ('draft', 'posted', 'received', 'awarded', 'open') THEN
    v_next_status := 'allocated';
  ELSIF p_driver_id IS NULL AND lower(coalesce(v_job.status::text, '')) = 'allocated' THEN
    v_next_status := CASE WHEN v_job.awarded_carrier_company_id IS NOT NULL THEN 'awarded' ELSE 'posted' END;
  END IF;

  UPDATE public.jobs
  SET assigned_driver_id = p_driver_id,
      assigned_company_id = CASE WHEN p_driver_id IS NULL THEN NULL ELSE v_allowed_company_id END,
      status = v_next_status,
      current_status = v_next_status,
      updated_at = now()
  WHERE id = p_job_id;

  v_note := CASE WHEN p_driver_id IS NULL THEN 'Driver assignment cleared.' ELSE 'Driver assigned.' END;

  INSERT INTO public.job_tracking_events (job_id, event_type, created_by, note)
  VALUES (p_job_id, CASE WHEN p_driver_id IS NULL THEN 'note'::public.tracking_event_type ELSE 'allocated'::public.tracking_event_type END, p_actor_user_id, v_note);

  RETURN QUERY
  SELECT j.id, j.status::text, j.current_status::text, j.assigned_driver_id, j.assigned_company_id, j.awarded_carrier_company_id
  FROM public.jobs j
  WHERE j.id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_job_driver_atomic(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_job_driver_atomic(uuid, uuid, uuid, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.accept_job_bid_atomic(uuid, uuid);

CREATE FUNCTION public.accept_job_bid_atomic(
  p_actor_user_id uuid,
  p_bid_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := coalesce(auth.uid(), p_actor_user_id);
  v_job_id uuid;
  v_owner_company_id uuid;
  v_bidder_company_id uuid;
  v_driver_id uuid;
BEGIN
  IF p_bid_id IS NULL THEN
    RAISE EXCEPTION 'p_bid_id is required';
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT jb.job_id, j.company_id, jb.bidder_company_id
  INTO v_job_id, v_owner_company_id, v_bidder_company_id
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id
  FOR UPDATE;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = v_owner_company_id
      AND cm.user_id = v_actor
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin', 'member', 'dispatcher')
  ) THEN
    RAISE EXCEPTION 'Not authorized to accept bids for this job';
  END IF;

  SELECT d.id
  INTO v_driver_id
  FROM public.drivers d
  WHERE d.company_id = v_bidder_company_id
    AND coalesce(d.status, 'active') = 'active'
    AND coalesce(d.is_active, true) = true
    AND coalesce(d.app_access, true) = true
  ORDER BY d.created_at NULLS LAST, d.id
  LIMIT 1;

  UPDATE public.job_bids jb
  SET status = CASE WHEN jb.id = p_bid_id THEN 'accepted' ELSE 'rejected' END,
      updated_at = now()
  WHERE jb.job_id = v_job_id
    AND jb.status IN ('submitted', 'accepted');

  UPDATE public.jobs j
  SET accepted_bid_id = p_bid_id,
      awarded_carrier_company_id = v_bidder_company_id,
      assigned_company_id = v_bidder_company_id,
      assigned_driver_id = coalesce(j.assigned_driver_id, v_driver_id),
      status = 'allocated',
      current_status = 'allocated',
      updated_at = now()
  WHERE j.id = v_job_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'job_id', v_job_id,
    'accepted_bid_id', p_bid_id,
    'awarded_carrier_company_id', v_bidder_company_id,
    'assigned_driver_id', v_driver_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
