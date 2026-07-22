-- Phase 1 security containment: atomic, service-role-only Companies House registration.
--
-- This migration is forward-only. It does not alter historical migrations and it
-- intentionally leaves the existing onboarding RPCs unchanged.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.company_registration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  company_number text NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'reused')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_registration_audit_actor_created_idx
  ON public.company_registration_audit (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS company_registration_audit_company_created_idx
  ON public.company_registration_audit (company_id, created_at DESC);

ALTER TABLE public.company_registration_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_registration_audit FROM PUBLIC;
REVOKE ALL ON TABLE public.company_registration_audit FROM anon;
REVOKE ALL ON TABLE public.company_registration_audit FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.company_registration_audit TO service_role;

DROP FUNCTION IF EXISTS public.register_validated_company_atomic(uuid, text, text, text);

CREATE FUNCTION public.register_validated_company_atomic(
  p_actor_user_id uuid,
  p_company_number text,
  p_company_name text,
  p_registry_status text
)
RETURNS TABLE (
  success boolean,
  http_status integer,
  error_code text,
  error_message text,
  company_id uuid,
  created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_number text := regexp_replace(upper(trim(coalesce(p_company_number, ''))), '[^A-Z0-9]', '', 'g');
  v_company_name text := trim(coalesce(p_company_name, ''));
  v_registry_status text := lower(trim(coalesce(p_registry_status, '')));
  v_company public.companies%ROWTYPE;
  v_existing_owner boolean := false;
  v_created boolean := false;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RETURN QUERY SELECT false, 401, 'AUTH_REQUIRED', 'Authenticated actor is required.', NULL::uuid, false;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_actor_user_id) THEN
    RETURN QUERY SELECT false, 401, 'INVALID_ACTOR', 'Authenticated actor does not exist.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_company_number = '' OR length(v_company_number) > 32 THEN
    RETURN QUERY SELECT false, 400, 'INVALID_COMPANY_NUMBER', 'Company number is invalid.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_company_name = '' OR length(v_company_name) > 500 THEN
    RETURN QUERY SELECT false, 400, 'INVALID_COMPANY_NAME', 'Company name is invalid.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_registry_status <> 'active' THEN
    RETURN QUERY SELECT false, 409, 'REGISTRY_STATUS_NOT_ACTIVE', 'Only active Companies House records may be registered.', NULL::uuid, false;
    RETURN;
  END IF;

  -- Serialize retries for the same actor and simultaneous attempts for the same
  -- Companies House number without requiring a potentially unsafe cleanup of
  -- historical duplicate rows during this containment migration.
  PERFORM pg_advisory_xact_lock(hashtextextended('register-company-user:' || p_actor_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('register-company-number:' || v_company_number, 0));

  -- Prefer an existing company already owned by this actor. If historical
  -- duplicates exist, this makes same-user retries deterministic while still
  -- rejecting takeover of a company owned by somebody else.
  SELECT c.*
  INTO v_company
  FROM public.companies c
  LEFT JOIN public.company_memberships cm
    ON cm.company_id = c.id
   AND cm.user_id = p_actor_user_id
   AND cm.status = 'active'
   AND cm.role_in_company = 'owner'
  WHERE regexp_replace(upper(trim(coalesce(c.company_number, ''))), '[^A-Z0-9]', '', 'g') = v_company_number
  ORDER BY ((c.created_by = p_actor_user_id) OR cm.id IS NOT NULL) DESC,
           c.created_at ASC,
           c.id ASC
  LIMIT 1
  FOR UPDATE OF c;

  IF FOUND THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      WHERE cm.company_id = v_company.id
        AND cm.user_id = p_actor_user_id
        AND cm.status = 'active'
        AND cm.role_in_company = 'owner'
    )
    INTO v_existing_owner;

    IF v_company.created_by IS DISTINCT FROM p_actor_user_id AND NOT v_existing_owner THEN
      RETURN QUERY SELECT false, 409, 'COMPANY_ALREADY_REGISTERED',
        'This company number is already registered to another account.', v_company.id, false;
      RETURN;
    END IF;

    v_created := false;
  ELSE
    INSERT INTO public.companies (
      name,
      company_number,
      status,
      created_by
    )
    VALUES (
      v_company_name,
      v_company_number,
      'pending_approval',
      p_actor_user_id
    )
    RETURNING * INTO v_company;

    v_created := true;
  END IF;

  INSERT INTO public.company_memberships (
    company_id,
    user_id,
    role_in_company,
    status,
    updated_at
  )
  VALUES (
    v_company.id,
    p_actor_user_id,
    'owner',
    'active',
    now()
  )
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET
    role_in_company = 'owner',
    status = 'active',
    updated_at = now();

  -- Compatibility only: do not overwrite an existing profile company context.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'company_id'
  ) THEN
    EXECUTE
      'UPDATE public.profiles SET company_id = COALESCE(company_id, $1) WHERE user_id = $2'
      USING v_company.id, p_actor_user_id;
  END IF;

  INSERT INTO public.company_registration_audit (
    actor_user_id,
    company_id,
    company_number,
    action,
    metadata
  )
  VALUES (
    p_actor_user_id,
    v_company.id,
    v_company_number,
    CASE WHEN v_created THEN 'created' ELSE 'reused' END,
    jsonb_build_object(
      'company_name', v_company_name,
      'registry_status', v_registry_status,
      'source', 'companies_house_server_validation'
    )
  );

  RETURN QUERY SELECT true, CASE WHEN v_created THEN 201 ELSE 200 END,
    NULL::text, NULL::text, v_company.id, v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text) TO service_role;

COMMENT ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text)
IS 'Atomically registers a Companies House validated company for a server-authenticated actor. Service role only.';

NOTIFY pgrst, 'reload schema';

COMMIT;
