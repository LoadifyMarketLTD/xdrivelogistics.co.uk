BEGIN;

CREATE OR REPLACE FUNCTION public.approve_fleet_driver_invitation(
  p_invitation_id uuid,
  p_actor_user_id uuid
)
RETURNS public.fleet_driver_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
  v_required_docs text[] := ARRAY['driving_licence', 'proof_of_address', 'right_to_work'];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invitation
  FROM public.fleet_driver_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver invitation not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = v_invitation.company_id
      AND cm.user_id = p_actor_user_id
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
  ) THEN
    RAISE EXCEPTION 'Actor is not authorised for this company.' USING ERRCODE = '42501';
  END IF;

  IF v_invitation.status <> 'accepted' OR v_invitation.accepted_at IS NULL THEN
    RAISE EXCEPTION 'Invitation must be accepted before approval.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_required_docs) required(doc_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.driver_documents dd
      WHERE dd.driver_id = v_invitation.driver_id
        AND dd.doc_type = required.doc_type
        AND dd.file_path IS NOT NULL
        AND dd.status = 'approved'
        AND (dd.expiry_date IS NULL OR dd.expiry_date >= current_date)
    )
  ) THEN
    RAISE EXCEPTION 'Required driver documents are missing, unapproved or expired.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.fleet_driver_invitations
  SET status = 'approved',
      approved_at = now(),
      approved_by = p_actor_user_id,
      token_hash = NULL,
      updated_at = now()
  WHERE id = p_invitation_id
  RETURNING * INTO v_invitation;

  UPDATE public.drivers
  SET status = 'active',
      app_access = true,
      must_change_password = false,
      updated_at = now()
  WHERE id = v_invitation.driver_id
    AND company_id = v_invitation.company_id
    AND user_id = v_invitation.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver record is missing or belongs to another tenant.' USING ERRCODE = '23503';
  END IF;

  UPDATE public.company_memberships
  SET role_in_company = 'driver',
      status = 'active',
      invited_email = v_invitation.invited_email,
      updated_at = now()
  WHERE company_id = v_invitation.company_id
    AND user_id = v_invitation.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver membership is missing.' USING ERRCODE = '23503';
  END IF;

  UPDATE public.profiles
  SET role = 'driver',
      status = 'active',
      is_driver = true,
      updated_at = now()
  WHERE user_id = v_invitation.user_id;

  RETURN v_invitation;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_fleet_driver_invitation(
  p_invitation_id uuid,
  p_actor_user_id uuid
)
RETURNS public.fleet_driver_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invitation
  FROM public.fleet_driver_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver invitation not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = v_invitation.company_id
      AND cm.user_id = p_actor_user_id
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
  ) THEN
    RAISE EXCEPTION 'Actor is not authorised for this company.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.fleet_driver_invitations
  SET status = 'revoked',
      token_hash = NULL,
      revoked_at = now(),
      revoked_by = p_actor_user_id,
      approved_at = NULL,
      approved_by = NULL,
      updated_at = now()
  WHERE id = p_invitation_id
  RETURNING * INTO v_invitation;

  UPDATE public.drivers
  SET status = 'suspended',
      app_access = false,
      updated_at = now()
  WHERE id = v_invitation.driver_id;

  UPDATE public.company_memberships
  SET status = 'suspended',
      updated_at = now()
  WHERE company_id = v_invitation.company_id
    AND user_id = v_invitation.user_id
    AND role_in_company IN ('driver', 'member');

  RETURN v_invitation;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_fleet_driver_invitation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_fleet_driver_invitation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_fleet_driver_invitation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_fleet_driver_invitation(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
