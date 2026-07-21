-- Server-side onboarding submit/review uses the Supabase service role. Keep the
-- owner-only rule for ordinary authenticated callers, while allowing the
-- trusted service role to perform audited transitions on their behalf.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_company_status_governance(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_event_type text,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_status text;
  v_new_status public.company_status;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_actor_user_id
      AND p.role = 'owner'
      AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only an active platform owner may change company status.'
      USING ERRCODE = '42501';
  END IF;

  IF p_event_type NOT IN (
    'company_suspended',
    'company_unsuspended',
    'company_approved',
    'company_rejected',
    'customer_onboarding_completed',
    'onboarding_resubmitted',
    'onboarding_changes_requested'
  ) THEN
    RAISE EXCEPTION 'Invalid company governance event: %', p_event_type
      USING ERRCODE = '22023';
  END IF;

  IF p_status NOT IN ('active', 'pending_approval', 'suspended', 'rejected') THEN
    RAISE EXCEPTION 'Invalid company status: %', p_status
      USING ERRCODE = '22023';
  END IF;

  v_new_status := p_status::public.company_status;

  SELECT c.status::text
  INTO v_old_status
  FROM public.companies c
  WHERE c.id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_status = p_status THEN
    RETURN;
  END IF;

  IF NOT (
    (v_old_status = 'active' AND p_status = 'suspended') OR
    (v_old_status = 'suspended' AND p_status = 'active') OR
    (v_old_status = 'pending_approval' AND p_status IN ('active', 'rejected')) OR
    (v_old_status = 'rejected' AND p_status = 'pending_approval')
  ) THEN
    RAISE EXCEPTION 'Invalid company status transition: % -> %', v_old_status, p_status
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.company_status_transition', p_event_type, true);
  UPDATE public.companies
  SET status = v_new_status,
      status_reason = NULLIF(trim(p_reason), ''),
      status_changed_at = now(),
      status_changed_by = p_actor_user_id,
      updated_at = now()
  WHERE id = p_company_id;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    p_actor_user_id,
    p_event_type,
    'company',
    p_company_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object(
      'status', p_status,
      'reason', NULLIF(trim(p_reason), '')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
