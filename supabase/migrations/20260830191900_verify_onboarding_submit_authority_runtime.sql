BEGIN;

-- P0-07 runtime proof. Build a rollback-only synthetic Owner Driver authority
-- chain so the proof is valid on both hosted production-shaped databases and
-- zero-data fresh previews. No private user/account row is used as a fixture.
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.submit_onboarding_application(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated can still execute the legacy one-argument submit RPC.';
  END IF;

  IF has_function_privilege('authenticated', 'public.submit_onboarding_application(uuid,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated can still execute the actor-bound submit RPC.';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.submit_onboarding_application(uuid)'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.submit_onboarding_application(uuid,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Service submission authority is unavailable during staged rollout.';
  END IF;
END;
$$;

CREATE TEMP TABLE p0_07_authority_probe (
  fixture_user_id uuid NOT NULL,
  outsider_user_id uuid NOT NULL,
  fixture_company_id uuid NOT NULL,
  fixture_application_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO p0_07_authority_probe
SELECT gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

SAVEPOINT p0_07_authority_fixture;

INSERT INTO auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  email_confirmed_at,
  created_at,
  updated_at
)
SELECT
  fixture_user_id,
  'p0-07-owner-driver-' || fixture_user_id::text || '@xdrive.invalid',
  jsonb_build_object('role', 'owner_driver'),
  jsonb_build_object('full_name', 'P0-07 Synthetic Owner Driver'),
  now(),
  now(),
  now()
FROM p0_07_authority_probe
UNION ALL
SELECT
  outsider_user_id,
  'p0-07-outsider-' || outsider_user_id::text || '@xdrive.invalid',
  jsonb_build_object('role', 'customer'),
  jsonb_build_object('full_name', 'P0-07 Synthetic Outsider'),
  now(),
  now(),
  now()
FROM p0_07_authority_probe;

INSERT INTO public.companies (
  id,
  name,
  status,
  company_type,
  created_by
)
SELECT
  fixture_company_id,
  'P0-07 Synthetic Owner Driver Company',
  'active',
  'carrier',
  fixture_user_id
FROM p0_07_authority_probe;

INSERT INTO public.platform_identity_registry (
  user_id,
  company_id,
  identity_mode,
  status,
  verified_at
)
SELECT
  fixture_user_id,
  fixture_company_id,
  'owner_driver',
  'active',
  now()
FROM p0_07_authority_probe;

INSERT INTO public.onboarding_applications (
  id,
  user_id,
  email,
  account_type,
  status,
  company_id,
  workspace_mode,
  owner_driver_workspace,
  payload
)
SELECT
  fixture_application_id,
  fixture_user_id,
  'p0-07-owner-driver-' || fixture_user_id::text || '@xdrive.invalid',
  'owner_driver',
  'draft',
  fixture_company_id,
  'owner_driver',
  true,
  '{}'::jsonb
FROM p0_07_authority_probe;

DO $$
DECLARE
  v_application_id uuid;
  v_user_id uuid;
  v_outsider_user_id uuid;
  v_rejected boolean := false;
BEGIN
  SELECT p.fixture_application_id, p.fixture_user_id, p.outsider_user_id
  INTO v_application_id, v_user_id, v_outsider_user_id
  FROM p0_07_authority_probe p
  LIMIT 1;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_identity_registry i
    JOIN public.onboarding_applications oa
      ON oa.user_id = i.user_id
     AND oa.company_id = i.company_id
    WHERE i.user_id = v_user_id
      AND oa.id = v_application_id
      AND i.identity_mode = 'owner_driver'
      AND i.status = 'active'
      AND i.verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Synthetic P0-07 Owner Driver authority chain was not established.';
  END IF;

  BEGIN
    PERFORM public.submit_onboarding_application(v_application_id, v_outsider_user_id);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Actor-bound submit accepted a user id that does not own the application.';
  END IF;

  UPDATE public.onboarding_applications
  SET status = 'submitted', last_activity_at = now()
  WHERE id = v_application_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications
    WHERE id = v_application_id
      AND status = 'under_review'
  ) THEN
    RAISE EXCEPTION 'Legacy submitted status was not normalized to under_review.';
  END IF;
END;
$$;

ROLLBACK TO SAVEPOINT p0_07_authority_fixture;
RELEASE SAVEPOINT p0_07_authority_fixture;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM p0_07_authority_probe p
    JOIN auth.users u ON u.id IN (p.fixture_user_id, p.outsider_user_id)
  ) OR EXISTS (
    SELECT 1
    FROM p0_07_authority_probe p
    JOIN public.companies c ON c.id = p.fixture_company_id
  ) OR EXISTS (
    SELECT 1
    FROM p0_07_authority_probe p
    JOIN public.onboarding_applications oa ON oa.id = p.fixture_application_id
  ) OR EXISTS (
    SELECT 1
    FROM p0_07_authority_probe p
    JOIN public.platform_identity_registry i ON i.user_id = p.fixture_user_id
  ) THEN
    RAISE EXCEPTION 'P0-07 synthetic authority fixture did not roll back cleanly.';
  END IF;
END;
$$;

COMMIT;
