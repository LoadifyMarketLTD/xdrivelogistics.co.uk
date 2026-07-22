BEGIN;

-- The disposable Supabase project exposes pgcrypto through the extensions
-- schema, while older environments may expose digest through public. Generate
-- the opaque token without depending on a schema-specific random-byte function
-- and resolve SHA-256 explicitly so rotation behaves consistently.
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
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
  v_raw_token text;
  v_token_hash text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.fleet_driver_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver invitation not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT p_force
     AND v_invitation.last_sent_at > now() - interval '60 seconds' THEN
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

  -- Two version-4 UUID values provide a 64-character opaque token.
  v_raw_token := replace(gen_random_uuid()::text, '-', '')
    || replace(gen_random_uuid()::text, '-', '');

  IF to_regprocedure('extensions.digest(text,text)') IS NOT NULL THEN
    EXECUTE 'SELECT encode(extensions.digest($1, ''sha256''), ''hex'')'
      INTO v_token_hash
      USING v_raw_token;
  ELSIF to_regprocedure('public.digest(text,text)') IS NOT NULL THEN
    EXECUTE 'SELECT encode(public.digest($1, ''sha256''), ''hex'')'
      INTO v_token_hash
      USING v_raw_token;
  ELSIF to_regprocedure('pg_catalog.sha256(bytea)') IS NOT NULL THEN
    EXECUTE 'SELECT encode(pg_catalog.sha256(convert_to($1, ''UTF8'')), ''hex'')'
      INTO v_token_hash
      USING v_raw_token;
  ELSE
    RAISE EXCEPTION 'SHA-256 digest support is unavailable for invitation token rotation.'
      USING ERRCODE = '0A000';
  END IF;

  IF v_token_hash IS NULL OR length(v_token_hash) <> 64 THEN
    RAISE EXCEPTION 'Invitation token hashing failed.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.fleet_driver_invitations fdi
  SET token_hash = v_token_hash,
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

REVOKE ALL ON FUNCTION public.rotate_fleet_driver_invitation_token(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_fleet_driver_invitation_token(uuid, uuid, boolean)
  TO service_role;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.rotate_fleet_driver_invitation_token(uuid,uuid,boolean)'::regprocedure)
  INTO v_definition;

  IF v_definition IS NULL
     OR position('v_raw_token := encode(gen_random_bytes' IN v_definition) > 0
     OR position('v_token_hash' IN v_definition) = 0
     OR position('gen_random_uuid' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Fleet invitation token crypto reconciliation failed.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
