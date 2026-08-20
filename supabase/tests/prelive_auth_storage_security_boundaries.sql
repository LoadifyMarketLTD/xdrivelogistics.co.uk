-- Real-database PreLive P0 regression test.
-- Run only against a disposable/local/staging database after all migrations.
-- The transaction is always rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_equal(p_actual text, p_expected text, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '% Expected %, got %.', p_message, p_expected, p_actual;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Auth bootstrap: hostile platform-owner/status metadata must fail closed.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '21000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'prelive-hostile-owner@example.test',
    '',
    '{}'::jsonb,
    '{"role":"platform_owner","requested_role":"owner","status":"suspended"}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'prelive-dispatcher@example.test',
    '',
    '{}'::jsonb,
    '{"role":"company_staff","requested_role":"dispatcher"}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'prelive-fleet@example.test',
    '',
    '{}'::jsonb,
    '{"role":"company_admin","requested_role":"fleet_operator"}'::jsonb,
    now(),
    now()
  );

SELECT pg_temp.assert_equal(
  (SELECT role::text FROM public.profiles WHERE user_id = '21000000-0000-0000-0000-000000000001'),
  'customer',
  'Hostile platform_owner signup metadata was trusted.'
);

SELECT pg_temp.assert_equal(
  (SELECT status::text FROM public.profiles WHERE user_id = '21000000-0000-0000-0000-000000000001'),
  'active',
  'Hostile signup metadata controlled authoritative profile status.'
);

SELECT pg_temp.assert_equal(
  (SELECT role::text FROM public.profiles WHERE user_id = '21000000-0000-0000-0000-000000000002'),
  'company_staff',
  'Legitimate dispatcher/company_staff identity was broken by the hardening.'
);

SELECT pg_temp.assert_equal(
  (SELECT role::text FROM public.profiles WHERE user_id = '21000000-0000-0000-0000-000000000003'),
  'company_admin',
  'Legitimate fleet/company_admin identity was broken by the hardening.'
);

-- Authenticated self-mutation of authoritative profile fields must fail.
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '21000000-0000-0000-0000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles
    SET role = 'owner', status = 'active'
    WHERE user_id = '21000000-0000-0000-0000-000000000001';

    RAISE EXCEPTION 'Authenticated user unexpectedly changed authoritative profile fields.';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;
RESET ROLE;

SELECT pg_temp.assert_equal(
  (SELECT role::text FROM public.profiles WHERE user_id = '21000000-0000-0000-0000-000000000001'),
  'customer',
  'Self profile mutation changed role after the guard test.'
);

-- ---------------------------------------------------------------------------
-- Storage review authority: direct global reads are Platform Owner only.
-- Company members use the separately tested tenant-validated signed-URL API.
-- ---------------------------------------------------------------------------
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN (
        'onboarding_docs_select_reviewer',
        'onboarding_docs_select_tenant_reviewer'
      )
  ),
  'A superseded onboarding document reviewer policy still exists.'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'onboarding_docs_select_platform_owner'
  ),
  'Platform-Owner-only onboarding document reviewer policy is missing.'
);

SELECT pg_temp.assert_true(
  (
    SELECT
      position('profiles' in lower(qual)) > 0
      AND position('owner' in lower(qual)) > 0
      AND position('active' in lower(qual)) > 0
      AND position('company_memberships' in lower(qual)) = 0
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'onboarding_docs_select_platform_owner'
  ),
  'Direct onboarding document review is not exclusively bound to active Platform Owner authority.'
);

-- The service-only Platform Owner promotion path must remain private.
SELECT pg_temp.assert_true(
  NOT has_function_privilege('authenticated', 'public.promote_to_platform_owner(text)', 'EXECUTE'),
  'Authenticated role can execute promote_to_platform_owner(text).'
);
SELECT pg_temp.assert_true(
  has_function_privilege('service_role', 'public.promote_to_platform_owner(text)', 'EXECUTE'),
  'Service role lost the canonical Platform Owner promotion path.'
);

ROLLBACK;
