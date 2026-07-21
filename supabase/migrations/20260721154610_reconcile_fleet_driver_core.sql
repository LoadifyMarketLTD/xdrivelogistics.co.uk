BEGIN;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY driver_id, doc_type
      ORDER BY
        (file_path IS NOT NULL) DESC,
        (status = 'approved') DESC,
        verified_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS position
  FROM public.driver_documents
)
DELETE FROM public.driver_documents target
USING ranked
WHERE target.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS driver_documents_driver_type_uidx
  ON public.driver_documents (driver_id, doc_type);

CREATE UNIQUE INDEX IF NOT EXISTS drivers_company_user_uidx
  ON public.drivers (company_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rotate_fleet_driver_invitation_token(
  p_invitation_id uuid,
  p_actor_user_id uuid,
  p_force boolean DEFAULT false
)
RETURNS TABLE (
  invitation_id uuid,
  raw_token text,
  expires_at timestamptz,
  last_sent_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
  v_raw_token text;
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

  IF NOT p_force AND v_invitation.last_sent_at > now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'Invitation resend is rate limited.' USING ERRCODE = 'P0001';
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

  v_raw_token := encode(gen_random_bytes(32), 'hex');

  UPDATE public.fleet_driver_invitations fdi
  SET token_hash = encode(digest(v_raw_token, 'sha256'), 'hex'),
      status = 'invited',
      expires_at = now() + interval '48 hours',
      last_sent_at = now(),
      accepted_at = NULL,
      approved_at = NULL,
      approved_by = NULL,
      revoked_at = NULL,
      revoked_by = NULL,
      updated_at = now()
  WHERE fdi.id = p_invitation_id
  RETURNING fdi.id, fdi.expires_at, fdi.last_sent_at
  INTO invitation_id, expires_at, last_sent_at;

  raw_token := v_raw_token;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.fleet_driver_compliance_current(p_driver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
  v_required_docs text[] := ARRAY['driving_licence', 'proof_of_address', 'right_to_work'];
BEGIN
  IF p_driver_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_invitation
  FROM public.fleet_driver_invitations
  WHERE driver_id = p_driver_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_invitation.status <> 'approved'
     OR v_invitation.accepted_at IS NULL
     OR v_invitation.approved_at IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(v_required_docs) required(doc_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.driver_documents dd
      WHERE dd.driver_id = p_driver_id
        AND dd.doc_type = required.doc_type
        AND dd.file_path IS NOT NULL
        AND dd.status = 'approved'
        AND (dd.expiry_date IS NULL OR dd.expiry_date >= current_date)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_fleet_driver_invitation_token(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fleet_driver_compliance_current(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_fleet_driver_invitation_token(uuid, uuid, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fleet_driver_compliance_current(uuid)
  TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.rotate_fleet_driver_invitation_token(uuid,uuid,boolean)') IS NULL
     OR to_regprocedure('public.fleet_driver_compliance_current(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Fleet Driver core function reconciliation failed.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
