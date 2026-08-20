-- Real-database PreLive P0 regression test.
-- Run only against a disposable/local/staging database after all migrations.
-- The transaction is always rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);

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
-- Auth bootstrap: all raw_user_meta_data role/status values are request data.
-- They must never create authoritative profile role or status.
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
    'prelive-hostile-dispatcher@example.test',
    '',
    '{}'::jsonb,
    '{"role":"company_staff","requested_role":"dispatcher","status":"active"}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'prelive-hostile-fleet@example.test',
    '',
    '{}'::jsonb,
    '{"role":"company_admin","requested_role":"fleet_operator","status":"active"}'::jsonb,
    now(),
    now()
  );

SELECT pg_temp.assert_equal(
  (SELECT role::text FROM public.profiles WHERE user_id = '21000000-0000-0000-0000-000000000001'),
  NULL::text,
  'Hostile platform_owner signup metadata granted an authoritative profile role.'
);
SELECT pg_temp.assert_equal(
  (SELECT role::text FROM public.profiles WHERE user_id = '21000000-0000-0000-0000-000000000002'),
  NULL::text,
  'Public dispatcher/company_staff metadata granted an authoritative profile role.'
);
SELECT pg_temp.assert_equal(
  (SELECT role::text FROM public.profiles WHERE user_id = '21000000-0000-0000-0000-000000000003'),
  NULL::text,
  'Public fleet/company_admin metadata granted an authoritative profile role.'
);
SELECT pg_temp.assert_equal(
  (SELECT status::text FROM public.profiles WHERE user_id = '21000000-0000-0000-0000-000000000001'),
  'active',
  'Hostile signup metadata controlled authoritative profile status.'
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
  NULL::text,
  'Self profile mutation changed role after the guard test.'
);

-- ---------------------------------------------------------------------------
-- Verified Fleet registration may create an active owner membership, but the
-- company remains pending_approval. That creator must not be able to activate
-- the company through authenticated RLS/API authority.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_registration record;
BEGIN
  SELECT *
  INTO v_registration
  FROM public.register_validated_company_atomic(
    '21000000-0000-0000-0000-000000000003',
    'PLV9Z1',
    'PreLive Fleet Authority Probe Ltd',
    'active',
    'fleet_courier'
  );

  IF NOT COALESCE(v_registration.success, false) OR v_registration.company_id IS NULL THEN
    RAISE EXCEPTION 'PreLive verified Fleet company fixture could not be created: % %',
      v_registration.error_code,
      v_registration.error_message;
  END IF;

  PERFORM pg_temp.assert_equal(
    (SELECT status::text FROM public.companies WHERE id = v_registration.company_id),
    'pending_approval',
    'Verified Fleet registration created an active company before governance approval.'
  );

  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      WHERE cm.company_id = v_registration.company_id
        AND cm.user_id = '21000000-0000-0000-0000-000000000003'
        AND cm.role_in_company::text = 'owner'
        AND cm.status::text = 'active'
    ),
    'Verified Fleet registration did not create the expected canonical owner membership fixture.'
  );
END;
$$;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '21000000-0000-0000-0000-000000000003',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;
UPDATE public.companies
SET status = 'active'
WHERE created_by = '21000000-0000-0000-0000-000000000003'
  AND company_number = 'PLV9Z1';
RESET ROLE;

SELECT pg_temp.assert_equal(
  (
    SELECT status::text
    FROM public.companies
    WHERE created_by = '21000000-0000-0000-0000-000000000003'
      AND company_number = 'PLV9Z1'
  ),
  'pending_approval',
  'Pending company creator self-activated the company through authenticated authority.'
);

-- The governance company-status RPC itself must remain service-role only.
SELECT pg_temp.assert_true(
  NOT has_function_privilege(
    'authenticated',
    'public.set_company_status_governance(uuid, uuid, text, text, text)',
    'EXECUTE'
  ),
  'Authenticated role can execute set_company_status_governance().'
);
SELECT pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.set_company_status_governance(uuid, uuid, text, text, text)',
    'EXECUTE'
  ),
  'Service role lost the canonical company-governance status RPC.'
);

-- ---------------------------------------------------------------------------
-- Notification runtime secrets must not be visible/callable by authenticated
-- users. app_settings is protected by a service-role-only RLS policy. The
-- authenticated role may retain table-level SELECT in Supabase, but RLS must
-- return zero secret rows. The dispatcher that reads settings internally is
-- separately service-role-only.
-- ---------------------------------------------------------------------------
SELECT pg_temp.assert_true(
  (
    SELECT c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'app_settings'
  ),
  'RLS is disabled on public.app_settings.'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_settings'
      AND policyname = 'app_settings_service_role_only'
      AND cmd = 'ALL'
      AND position('service_role' in lower(COALESCE(qual, ''))) > 0
  ),
  'app_settings service-role-only RLS policy is missing or no longer service-role bound.'
);
SELECT pg_temp.assert_true(
  NOT has_function_privilege(
    'authenticated',
    'public.dispatch_due_notification_events()',
    'EXECUTE'
  ),
  'Authenticated role can execute the notification dispatcher that reads service-role configuration.'
);

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
DECLARE
  v_visible_secret_rows integer := 0;
BEGIN
  BEGIN
    SELECT count(*)
    INTO v_visible_secret_rows
    FROM public.app_settings
    WHERE key IN ('supabase_service_role_key', 'notification_webhook_secret');
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_visible_secret_rows := 0;
  END;

  IF v_visible_secret_rows <> 0 THEN
    RAISE EXCEPTION 'Authenticated user can read % app_settings secret row(s).', v_visible_secret_rows;
  END IF;
END;
$$;
RESET ROLE;

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

SELECT pass('PreLive Auth privilege, company authority, app_settings and onboarding Storage DB boundaries passed.');
SELECT * FROM finish();
ROLLBACK;
