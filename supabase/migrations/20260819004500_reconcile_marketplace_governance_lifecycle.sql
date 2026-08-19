-- Reconcile the existing Marketplace governance RPC with the current canonical
-- jobs status/current_status contract. This migration does not add actions,
-- roles or permissions. It only makes the already-supported actions update the
-- canonical lifecycle fields atomically and consistently.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.apply_marketplace_governance_action(
  p_actor_user_id uuid,
  p_job_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  status text,
  company_id uuid,
  exchange_visibility text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text := lower(trim(COALESCE(p_action, '')));
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'Marketplace governance action executed by owner.');
  v_current_status text;
  v_current_visibility text;
  v_company_id uuid;
  v_old_value text;
  v_new_value text;
  v_audit_action_type text;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required for marketplace governance updates.'
      USING ERRCODE = '23502';
  END IF;

  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'job_id is required for marketplace governance updates.'
      USING ERRCODE = '23502';
  END IF;

  IF v_action NOT IN ('publish_to_exchange', 'hide_from_exchange', 'force_dispute', 'force_cancel') THEN
    RAISE EXCEPTION 'Invalid marketplace governance action: %', v_action
      USING ERRCODE = '23514';
  END IF;

  SELECT
    lower(trim(j.status::text)),
    lower(trim(j.exchange_visibility::text)),
    j.company_id
  INTO
    v_current_status,
    v_current_visibility,
    v_company_id
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Marketplace job not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_action = 'publish_to_exchange' THEN
    -- Preserve the existing allowed-state contract. The repair is that a draft
    -- cannot truthfully become visible on Marketplace while remaining draft.
    IF v_current_status NOT IN ('draft', 'posted') THEN
      RAISE EXCEPTION 'Cannot publish job in "%" status to exchange.', v_current_status
        USING ERRCODE = '23514';
    END IF;
    IF v_current_visibility = 'exchange' THEN
      RAISE EXCEPTION 'Job is already visible on exchange.'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs AS job_row
    SET status = CASE WHEN v_current_status = 'draft' THEN 'posted' ELSE job_row.status END,
        current_status = CASE
          WHEN v_current_status = 'draft' THEN 'posted'
          WHEN job_row.current_status IS NULL OR btrim(job_row.current_status) = '' THEN job_row.status::text
          ELSE job_row.current_status
        END,
        exchange_visibility = 'exchange',
        exchange_posted_at = now(),
        updated_at = now()
    WHERE job_row.id = p_job_id;

    v_old_value := 'visibility:' || v_current_visibility;
    v_new_value := 'visibility:exchange';
    v_audit_action_type := 'marketplace_published';
  ELSIF v_action = 'hide_from_exchange' THEN
    IF v_current_visibility <> 'exchange' THEN
      RAISE EXCEPTION 'Job visibility is "%", not exchange.', v_current_visibility
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs AS job_row
    SET exchange_visibility = 'private',
        updated_at = now()
    WHERE job_row.id = p_job_id;

    v_old_value := 'visibility:exchange';
    v_new_value := 'visibility:private';
    v_audit_action_type := 'marketplace_hidden';
  ELSIF v_action = 'force_dispute' THEN
    IF v_current_status NOT IN ('draft', 'posted', 'allocated', 'in_transit') THEN
      RAISE EXCEPTION 'Cannot change status from "%".', v_current_status
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs AS job_row
    SET status = 'disputed',
        current_status = 'disputed',
        updated_at = now()
    WHERE job_row.id = p_job_id;

    v_old_value := v_current_status;
    v_new_value := 'disputed';
    v_audit_action_type := 'marketplace_job_disputed';
  ELSE
    IF v_current_status NOT IN ('draft', 'posted', 'allocated', 'in_transit') THEN
      RAISE EXCEPTION 'Cannot change status from "%".', v_current_status
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs AS job_row
    SET status = 'cancelled',
        current_status = 'cancelled',
        updated_at = now()
    WHERE job_row.id = p_job_id;

    v_old_value := v_current_status;
    v_new_value := 'cancelled';
    v_audit_action_type := 'marketplace_job_cancelled';
  END IF;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_id,
    target_name,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    created_at
  )
  VALUES (
    p_actor_user_id,
    'job',
    p_job_id,
    format('Marketplace job %s', p_job_id),
    v_company_id,
    v_audit_action_type,
    v_old_value,
    v_new_value,
    v_reason,
    now()
  );

  RETURN QUERY
  SELECT
    j.id,
    j.status::text,
    j.company_id,
    j.exchange_visibility::text
  FROM public.jobs j
  WHERE j.id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) IS
  'Atomic Marketplace governance using the existing action contract; draft publication becomes posted and force cancel/dispute keep jobs.status and jobs.current_status synchronized.';

NOTIFY pgrst, 'reload schema';
COMMIT;
