BEGIN;

-- P0-04: the service-role governance RPC is itself an authority boundary.
-- The HTTP route already checked company compliance before activation, but a
-- direct/internal service-role call to set_company_status_governance() did not.
-- Make the database RPC fail closed so every activation path has the same gate.

CREATE OR REPLACE FUNCTION public.set_company_status_governance(
  p_actor_user_id uuid,
  p_target_company_id uuid,
  p_action_type text,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(company_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_new_status text := lower(trim(COALESCE(p_new_status, '')));
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'No reason provided.');
  v_status_type text;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required for governance status updates.'
      USING ERRCODE = '23502';
  END IF;

  SELECT c.status::text
  INTO v_old_status
  FROM public.companies c
  WHERE c.id = p_target_company_id
  FOR UPDATE;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Company not found for governance status update.'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.assert_company_status_transition(v_old_status, v_new_status);

  -- Database-authoritative activation gate. This runs for both first approval
  -- and reinstatement, so expired/revoked compliance cannot be bypassed by a
  -- direct service-role RPC call.
  IF v_new_status = 'active' THEN
    PERFORM public.assert_company_compliance_ready(p_target_company_id);
  END IF;

  PERFORM set_config('app.company_status_change_context', 'governance_api', true);

  SELECT format_type(a.atttypid, a.atttypmod)
  INTO v_status_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.companies'::regclass
    AND a.attname = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_status_type IS NULL THEN
    RAISE EXCEPTION 'companies.status physical type could not be resolved.'
      USING ERRCODE = '42703';
  END IF;

  EXECUTE format(
    'UPDATE public.companies SET status = $1::%s WHERE id = $2',
    v_status_type
  ) USING v_new_status, p_target_company_id;

  INSERT INTO public.owner_audit_log (
    target_type,
    target_id,
    target_name,
    target_company_id,
    actor_user_id,
    action_type,
    old_status,
    new_status,
    reason,
    created_at
  )
  VALUES (
    'company',
    p_target_company_id,
    format('Company %s', p_target_company_id),
    p_target_company_id,
    p_actor_user_id,
    p_action_type,
    lower(trim(v_old_status)),
    v_new_status,
    v_reason,
    now()
  );

  RETURN QUERY
  SELECT p_target_company_id, lower(trim(v_old_status)), v_new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) TO service_role;

COMMIT;
