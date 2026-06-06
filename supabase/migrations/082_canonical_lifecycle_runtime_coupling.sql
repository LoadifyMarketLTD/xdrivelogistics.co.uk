-- Migration 082: Canonical lifecycle runtime coupling and bid-award visibility

BEGIN;

-- Keep MVP guardrails aligned with the canonical lifecycle while preserving
-- compliance checks for exchange publish/execution flows.
CREATE OR REPLACE FUNCTION public.fn_jobs_mvp_guardrails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_next text[];
  v_carrier_company_id uuid;
  v_issues text[];
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_allowed_next := CASE OLD.status::text
      WHEN 'draft' THEN ARRAY['posted', 'cancelled', 'disputed']
      WHEN 'posted' THEN ARRAY['quoted', 'awarded', 'allocated', 'cancelled', 'disputed']
      WHEN 'quoted' THEN ARRAY['awarded', 'posted', 'cancelled', 'disputed']
      WHEN 'awarded' THEN ARRAY['allocated', 'cancelled', 'disputed']
      WHEN 'allocated' THEN ARRAY['collected', 'in_transit', 'cancelled', 'disputed']
      WHEN 'collected' THEN ARRAY['in_transit', 'cancelled', 'disputed']
      WHEN 'in_transit' THEN ARRAY['delivered', 'cancelled', 'disputed']
      WHEN 'delivered' THEN ARRAY['invoiced']
      WHEN 'invoiced' THEN ARRAY['paid']
      WHEN 'paid' THEN ARRAY[]::text[]
      WHEN 'cancelled' THEN ARRAY[]::text[]
      WHEN 'disputed' THEN ARRAY[]::text[]
      ELSE ARRAY[]::text[]
    END;

    IF NOT (NEW.status::text = ANY (v_allowed_next)) THEN
      RAISE EXCEPTION 'Invalid job status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  IF NEW.exchange_visibility = 'exchange'
     AND (TG_OP = 'INSERT' OR coalesce(OLD.exchange_visibility, '') <> 'exchange')
  THEN
    v_issues := public.company_compliance_issues(NEW.company_id, 'publish');
    IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Compliance blocked publish action: %', array_to_string(v_issues, ' ');
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)
  THEN
    IF NEW.status::text IN ('awarded', 'allocated', 'collected', 'in_transit', 'delivered') THEN
      v_carrier_company_id := coalesce(NEW.awarded_carrier_company_id, NEW.company_id);
      v_issues := public.company_compliance_issues(v_carrier_company_id, 'execution');
      IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Compliance blocked execution action: %', array_to_string(v_issues, ' ');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Persist explicit award stage before allocation in atomic bid acceptance.
CREATE OR REPLACE FUNCTION public.accept_job_bid_atomic(
  p_bid_id uuid,
  p_actor_user_id uuid
)
RETURNS TABLE (
  success boolean,
  http_status integer,
  error_code text,
  error_message text,
  bid_id uuid,
  job_id uuid,
  awarded_carrier_company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_job_company_id uuid;
  v_bid_company_id uuid;
  v_bid_status text;
  v_exchange_visibility text;
  v_awarded_carrier_company_id uuid;
  v_actor_role text;
  v_accepted_count integer;
  v_award_count integer;
  v_allocate_count integer;
  v_owner_driver_id uuid;
  v_bid_issues text[];
BEGIN
  SELECT
    jb.job_id,
    j.company_id,
    jb.company_id,
    jb.status,
    j.exchange_visibility,
    j.awarded_carrier_company_id
  INTO
    v_job_id,
    v_job_company_id,
    v_bid_company_id,
    v_bid_status,
    v_exchange_visibility,
    v_awarded_carrier_company_id
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id
  FOR UPDATE OF jb, j;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 404, 'NOT_FOUND', 'Bid not found.', NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT cm.role_in_company
  INTO v_actor_role
  FROM public.company_memberships cm
  WHERE cm.user_id = p_actor_user_id
    AND cm.company_id = v_job_company_id
    AND cm.status = 'active'
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN', 'Forbidden — you are not a member of the job-owning company.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_actor_role NOT IN ('owner', 'admin', 'dispatcher') THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN', 'Forbidden — insufficient role to accept bids.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_exchange_visibility NOT IN ('exchange', 'direct') THEN
    RETURN QUERY SELECT false, 400, 'BAD_REQUEST', 'Bad request — this job is not on the exchange.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_status <> 'submitted' THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — only submitted bids can be accepted.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_awarded_carrier_company_id IS NOT NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — this job has already been awarded to a carrier.', p_bid_id, v_job_id, v_awarded_carrier_company_id;
    RETURN;
  END IF;

  IF v_bid_company_id IS NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — bid company is missing.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_company_id = v_job_company_id THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN', 'Forbidden — cannot accept a bid placed by your own company.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  v_bid_issues := public.company_compliance_issues(v_bid_company_id, 'award');
  IF coalesce(array_length(v_bid_issues, 1), 0) > 0 THEN
    RETURN QUERY
      SELECT
        false,
        409,
        'COMPLIANCE_BLOCKED',
        format('Compliance blocked award action: %s', array_to_string(v_bid_issues, ' ')),
        p_bid_id,
        v_job_id,
        NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.job_bids
  SET status = 'accepted'
  WHERE id = p_bid_id
    AND status = 'submitted';
  GET DIAGNOSTICS v_accepted_count = ROW_COUNT;

  IF v_accepted_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — bid is no longer in submitted status.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.job_bids
  SET status = 'rejected'
  WHERE job_id = v_job_id
    AND id <> p_bid_id
    AND status = 'submitted';

  SELECT d.id
  INTO v_owner_driver_id
  FROM public.drivers d
  WHERE d.company_id = v_bid_company_id
    AND d.app_access = true
  ORDER BY d.created_at
  LIMIT 1;

  UPDATE public.jobs
  SET
    awarded_carrier_company_id = v_bid_company_id,
    status                     = 'awarded',
    status_history             = COALESCE(status_history, '[]'::jsonb)
                                   || jsonb_build_object(
                                        'status',    'awarded',
                                        'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                                      )
  WHERE id = v_job_id
    AND awarded_carrier_company_id IS NULL
    AND status IN ('posted', 'quoted');
  GET DIAGNOSTICS v_award_count = ROW_COUNT;

  IF v_award_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — job is no longer in an awardable status.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.jobs
  SET
    status             = 'allocated',
    assigned_driver_id = COALESCE(v_owner_driver_id, assigned_driver_id),
    status_history     = COALESCE(status_history, '[]'::jsonb)
                           || jsonb_build_object(
                                'status',    'allocated',
                                'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                              )
  WHERE id = v_job_id
    AND awarded_carrier_company_id = v_bid_company_id
    AND status = 'awarded';
  GET DIAGNOSTICS v_allocate_count = ROW_COUNT;

  IF v_allocate_count <> 1 THEN
    RAISE EXCEPTION 'Atomic allocation update failed for job %', v_job_id;
  END IF;

  RETURN QUERY SELECT true, 200, NULL::text, NULL::text, p_bid_id, v_job_id, v_bid_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

-- Couple invoice and payment lifecycle events to canonical job lifecycle.
CREATE OR REPLACE FUNCTION public.fn_sync_job_status_from_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('Pending', 'Overdue', 'Paid') THEN
      UPDATE public.jobs
      SET
        status = 'invoiced',
        status_history = COALESCE(status_history, '[]'::jsonb)
          || jsonb_build_object(
               'status',    'invoiced',
               'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             )
      WHERE id = NEW.job_id
        AND status = 'delivered';
    END IF;

    IF NEW.status = 'Paid' THEN
      UPDATE public.jobs
      SET
        status = 'paid',
        status_history = COALESCE(status_history, '[]'::jsonb)
          || jsonb_build_object(
               'status',    'paid',
               'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             )
      WHERE id = NEW.job_id
        AND status = 'invoiced';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('Pending', 'Overdue', 'Paid') THEN
      UPDATE public.jobs
      SET
        status = 'invoiced',
        status_history = COALESCE(status_history, '[]'::jsonb)
          || jsonb_build_object(
               'status',    'invoiced',
               'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             )
      WHERE id = NEW.job_id
        AND status = 'delivered';
    END IF;

    IF NEW.status = 'Paid' THEN
      UPDATE public.jobs
      SET
        status = 'paid',
        status_history = COALESCE(status_history, '[]'::jsonb)
          || jsonb_build_object(
               'status',    'paid',
               'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             )
      WHERE id = NEW.job_id
        AND status = 'invoiced';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_status_from_invoice ON public.invoices;
CREATE TRIGGER trg_sync_job_status_from_invoice
AFTER INSERT OR UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_job_status_from_invoice();

COMMIT;
