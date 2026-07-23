-- Server-authenticated, Companies House verified and retry-safe company registration.
-- Broker and fleet onboarding must claim one canonical company before submission.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.company_registration_claims (
  company_number text PRIMARY KEY,
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
  claimed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  registry_name text NOT NULL,
  registry_status text NOT NULL CHECK (registry_status = 'active'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_registration_claims_number_format_check
    CHECK (company_number ~ '^[A-Z0-9]{6,16}$')
);

CREATE TABLE IF NOT EXISTS public.company_registration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  company_number text NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'reused', 'rejected')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_registration_claims_actor_idx
  ON public.company_registration_claims (claimed_by, updated_at DESC);

CREATE INDEX IF NOT EXISTS company_registration_audit_actor_created_idx
  ON public.company_registration_audit (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS company_registration_audit_company_created_idx
  ON public.company_registration_audit (company_id, created_at DESC);

ALTER TABLE public.company_registration_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_registration_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_registration_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_registration_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.company_registration_claims TO service_role;
GRANT SELECT, INSERT ON TABLE public.company_registration_audit TO service_role;

-- Safely claim existing company numbers only when there is one unambiguous company
-- and one identifiable owner/creator. Legacy duplicates remain unclaimed and are
-- rejected by the registration RPC until an administrator resolves them.
WITH normalized_companies AS (
  SELECT
    c.id AS company_id,
    regexp_replace(upper(trim(coalesce(c.company_number, ''))), '[^A-Z0-9]', '', 'g') AS company_number,
    c.name AS registry_name,
    coalesce(
      (
        SELECT cm.user_id
        FROM public.company_memberships cm
        WHERE cm.company_id = c.id
          AND cm.status = 'active'
          AND cm.role_in_company = 'owner'
        ORDER BY cm.created_at ASC, cm.id ASC
        LIMIT 1
      ),
      c.created_by
    ) AS claimed_by
  FROM public.companies c
), eligible AS (
  SELECT
    n.*,
    count(*) OVER (PARTITION BY n.company_number) AS matching_companies
  FROM normalized_companies n
  WHERE n.company_number ~ '^[A-Z0-9]{6,16}$'
    AND n.claimed_by IS NOT NULL
)
INSERT INTO public.company_registration_claims (
  company_number,
  company_id,
  claimed_by,
  registry_name,
  registry_status
)
SELECT
  e.company_number,
  e.company_id,
  e.claimed_by,
  coalesce(nullif(trim(e.registry_name), ''), e.company_number),
  'active'
FROM eligible e
WHERE e.matching_companies = 1
ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS public.register_validated_company_atomic(uuid, text, text, text, text);

CREATE FUNCTION public.register_validated_company_atomic(
  p_actor_user_id uuid,
  p_company_number text,
  p_company_name text,
  p_registry_status text,
  p_account_type text
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
  v_account_type text := lower(trim(coalesce(p_account_type, '')));
  v_company_type text;
  v_company public.companies%ROWTYPE;
  v_match_count integer := 0;
  v_other_company_count integer := 0;
  v_authorized boolean := false;
  v_created boolean := false;
BEGIN
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_actor_user_id
  ) THEN
    RETURN QUERY SELECT false, 401, 'INVALID_ACTOR', 'Authenticated actor is required.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_company_number !~ '^[A-Z0-9]{6,16}$' THEN
    RETURN QUERY SELECT false, 400, 'INVALID_COMPANY_NUMBER', 'Company number is invalid.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_company_name = '' OR length(v_company_name) > 500 THEN
    RETURN QUERY SELECT false, 400, 'INVALID_COMPANY_NAME', 'Company name is invalid.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_registry_status <> 'active' THEN
    RETURN QUERY SELECT false, 409, 'REGISTRY_STATUS_NOT_ACTIVE', 'Only active Companies House records may register.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_account_type = 'broker_shipper' THEN
    v_company_type := 'broker';
  ELSIF v_account_type = 'fleet_courier' THEN
    v_company_type := 'carrier';
  ELSE
    RETURN QUERY SELECT false, 400, 'INVALID_ACCOUNT_TYPE', 'Company registration is limited to broker and fleet accounts.', NULL::uuid, false;
    RETURN;
  END IF;

  -- Same actor and same company-number requests are serialized. The actor lock
  -- also prevents simultaneous attempts to attach two different companies.
  PERFORM pg_advisory_xact_lock(hashtextextended('register-company-user:' || p_actor_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('register-company-number:' || v_company_number, 0));

  SELECT c.*
  INTO v_company
  FROM public.company_registration_claims claim
  JOIN public.companies c ON c.id = claim.company_id
  WHERE claim.company_number = v_company_number
  FOR UPDATE OF claim, c;

  IF NOT FOUND THEN
    SELECT count(*)
    INTO v_match_count
    FROM public.companies c
    WHERE regexp_replace(upper(trim(coalesce(c.company_number, ''))), '[^A-Z0-9]', '', 'g') = v_company_number;

    IF v_match_count > 1 THEN
      RETURN QUERY SELECT false, 409, 'DUPLICATE_LEGACY_COMPANIES',
        'Multiple existing companies use this company number. An administrator must resolve them.', NULL::uuid, false;
      RETURN;
    END IF;

    IF v_match_count = 1 THEN
      SELECT c.*
      INTO v_company
      FROM public.companies c
      WHERE regexp_replace(upper(trim(coalesce(c.company_number, ''))), '[^A-Z0-9]', '', 'g') = v_company_number
      FOR UPDATE;
    END IF;
  END IF;

  IF v_company.id IS NOT NULL THEN
    SELECT (
      v_company.created_by = p_actor_user_id
      OR EXISTS (
        SELECT 1
        FROM public.company_memberships cm
        WHERE cm.company_id = v_company.id
          AND cm.user_id = p_actor_user_id
          AND cm.status = 'active'
          AND cm.role_in_company = 'owner'
      )
    )
    INTO v_authorized;

    IF NOT v_authorized THEN
      RETURN QUERY SELECT false, 409, 'COMPANY_ALREADY_REGISTERED',
        'This company number is already registered to another account.', NULL::uuid, false;
      RETURN;
    END IF;

    SELECT count(DISTINCT c.id)
    INTO v_other_company_count
    FROM public.companies c
    WHERE c.id <> v_company.id
      AND (
        c.created_by = p_actor_user_id
        OR EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = c.id
            AND cm.user_id = p_actor_user_id
            AND cm.status = 'active'
            AND cm.role_in_company = 'owner'
        )
      );

    IF v_other_company_count > 0 THEN
      RETURN QUERY SELECT false, 409, 'ACCOUNT_HAS_MULTIPLE_COMPANIES',
        'This account is linked to another company. An administrator must confirm the correct company.', NULL::uuid, false;
      RETURN;
    END IF;

    v_created := false;
  ELSE
    SELECT count(DISTINCT c.id)
    INTO v_other_company_count
    FROM public.companies c
    WHERE c.created_by = p_actor_user_id
       OR EXISTS (
         SELECT 1
         FROM public.company_memberships cm
         WHERE cm.company_id = c.id
           AND cm.user_id = p_actor_user_id
           AND cm.status = 'active'
           AND cm.role_in_company = 'owner'
       );

    IF v_other_company_count > 0 THEN
      RETURN QUERY SELECT false, 409, 'ACCOUNT_ALREADY_LINKED_TO_COMPANY',
        'This account is already linked to another company.', NULL::uuid, false;
      RETURN;
    END IF;

    INSERT INTO public.companies (
      name,
      company_number,
      status,
      company_type,
      created_by
    )
    VALUES (
      v_company_name,
      v_company_number,
      'pending_approval',
      v_company_type,
      p_actor_user_id
    )
    RETURNING * INTO v_company;

    v_created := true;
  END IF;

  UPDATE public.companies
  SET name = v_company_name,
      company_number = v_company_number,
      company_type = v_company_type
  WHERE id = v_company.id;

  INSERT INTO public.company_registration_claims (
    company_number,
    company_id,
    claimed_by,
    registry_name,
    registry_status,
    updated_at
  )
  VALUES (
    v_company_number,
    v_company.id,
    p_actor_user_id,
    v_company_name,
    v_registry_status,
    now()
  )
  ON CONFLICT (company_number)
  DO UPDATE SET
    registry_name = EXCLUDED.registry_name,
    registry_status = EXCLUDED.registry_status,
    updated_at = now()
  WHERE public.company_registration_claims.company_id = EXCLUDED.company_id
    AND public.company_registration_claims.claimed_by = EXCLUDED.claimed_by;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_registration_claims claim
    WHERE claim.company_number = v_company_number
      AND claim.company_id = v_company.id
      AND claim.claimed_by = p_actor_user_id
  ) THEN
    RETURN QUERY SELECT false, 409, 'COMPANY_CLAIM_CONFLICT',
      'The company number was claimed by another registration.', NULL::uuid, false;
    RETURN;
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

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'company_id'
  ) THEN
    EXECUTE
      'UPDATE public.profiles SET company_id = COALESCE(company_id, $1), updated_at = now() WHERE user_id = $2'
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
      'registered_name', v_company_name,
      'registry_status', v_registry_status,
      'account_type', v_account_type,
      'source', 'companies_house_server_validation'
    )
  );

  RETURN QUERY SELECT true, CASE WHEN v_created THEN 201 ELSE 200 END,
    NULL::text, NULL::text, v_company.id, v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text, text)
IS 'Atomically registers or reuses one Companies House verified broker/fleet company for a server-authenticated actor. Service role only.';

NOTIFY pgrst, 'reload schema';

COMMIT;
