BEGIN;

-- P0-06 RLS proof. Use rollback-only synthetic fixtures so the migration proves
-- the real authenticated Storage policy contract on both production-shaped and
-- empty fresh databases without depending on private hosted rows.
SAVEPOINT p0_06_storage_fixture;

CREATE TEMP TABLE p0_06_storage_rls_probe (
  authorised_user_id uuid NOT NULL,
  outsider_user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  object_name text NOT NULL,
  authorised_visible integer,
  outsider_visible integer
) ON COMMIT DROP;

INSERT INTO p0_06_storage_rls_probe (
  authorised_user_id,
  outsider_user_id,
  company_id,
  driver_id,
  vehicle_id,
  object_name
)
SELECT
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  '';

UPDATE p0_06_storage_rls_probe
SET object_name = company_id::text || '/' || vehicle_id::text || '/p0-06-vehicle-proof.pdf';

-- Auth users are required because the canonical Driver identity gate binds
-- operational Driver access to a real authenticated identity. The auth trigger
-- creates minimal profiles; all rows remain inside the savepoint and are rolled
-- back after the proof.
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
  authorised_user_id,
  'p0-06-driver-' || authorised_user_id::text || '@xdrive.invalid',
  jsonb_build_object('role', 'driver'),
  jsonb_build_object('full_name', 'P0-06 Synthetic Driver'),
  now(),
  now(),
  now()
FROM p0_06_storage_rls_probe
UNION ALL
SELECT
  outsider_user_id,
  'p0-06-outsider-' || outsider_user_id::text || '@xdrive.invalid',
  jsonb_build_object('role', 'customer'),
  jsonb_build_object('full_name', 'P0-06 Synthetic Outsider'),
  now(),
  now(),
  now()
FROM p0_06_storage_rls_probe;

INSERT INTO public.companies (
  id,
  name,
  status,
  company_type,
  created_by
)
SELECT
  company_id,
  'P0-06 Synthetic Carrier',
  'active',
  'carrier',
  authorised_user_id
FROM p0_06_storage_rls_probe;

-- The membership identity gate downgrades an active Driver membership to
-- `invited` unless the canonical identity is already active and verified.
-- Establish identity authority first, exactly as the operational model requires.
INSERT INTO public.platform_identity_registry (
  user_id,
  company_id,
  identity_mode,
  status,
  verified_at
)
SELECT
  authorised_user_id,
  company_id,
  'company_driver',
  'active',
  now()
FROM p0_06_storage_rls_probe;

-- Storage policy evaluation reaches vehicles under its own RLS. Reconstruct the
-- same active company-membership authority an operational Driver has, after the
-- identity gate is satisfied. The outsider deliberately receives no membership.
INSERT INTO public.company_memberships (
  company_id,
  user_id,
  role_in_company,
  status
)
SELECT
  company_id,
  authorised_user_id,
  'viewer'::public.company_role,
  'active'
FROM p0_06_storage_rls_probe;

INSERT INTO public.drivers (
  id,
  company_id,
  user_id,
  display_name,
  name,
  full_name,
  email,
  status,
  is_active,
  app_access
)
SELECT
  driver_id,
  company_id,
  authorised_user_id,
  'P0-06 Synthetic Driver',
  'P0-06 Synthetic Driver',
  'P0-06 Synthetic Driver',
  'p0-06-driver-' || authorised_user_id::text || '@xdrive.invalid',
  'active'::public.status_enum,
  true,
  true
FROM p0_06_storage_rls_probe;

INSERT INTO public.vehicles (
  id,
  company_id,
  assigned_driver_id,
  type,
  advertising_state
)
SELECT
  vehicle_id,
  company_id,
  driver_id,
  'van_large'::public.vehicle_type,
  'none'
FROM p0_06_storage_rls_probe;

INSERT INTO storage.objects (
  bucket_id,
  name,
  owner,
  owner_id,
  metadata
)
SELECT
  'vehicle-docs',
  object_name,
  authorised_user_id,
  authorised_user_id::text,
  '{}'::jsonb
FROM p0_06_storage_rls_probe;

GRANT SELECT, UPDATE ON p0_06_storage_rls_probe TO authenticated;

-- Evaluate the real policy as authenticated, first as the assigned Driver and
-- then as an unrelated identity with no company membership/Driver authority.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT authorised_user_id::text FROM p0_06_storage_rls_probe LIMIT 1),
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

UPDATE p0_06_storage_rls_probe p
SET authorised_visible = (
  SELECT count(*)::integer
  FROM storage.objects o
  WHERE o.bucket_id = 'vehicle-docs'
    AND o.name = p.object_name
);

SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT outsider_user_id::text FROM p0_06_storage_rls_probe LIMIT 1),
  true
);

UPDATE p0_06_storage_rls_probe p
SET outsider_visible = (
  SELECT count(*)::integer
  FROM storage.objects o
  WHERE o.bucket_id = 'vehicle-docs'
    AND o.name = p.object_name
);

RESET ROLE;

DO $$
DECLARE
  v_authorised integer;
  v_outsider integer;
BEGIN
  SELECT authorised_visible, outsider_visible
  INTO v_authorised, v_outsider
  FROM p0_06_storage_rls_probe
  LIMIT 1;

  IF v_authorised <> 1 THEN
    RAISE EXCEPTION 'Assigned Driver could not read their canonical vehicle document through RLS (visible=%).', v_authorised;
  END IF;

  IF v_outsider <> 0 THEN
    RAISE EXCEPTION 'Unrelated authenticated identity could read another company vehicle document through RLS (visible=%).', v_outsider;
  END IF;
END;
$$;

-- Remove every synthetic auth/public/storage row atomically. A failed assertion
-- aborts the migration; a successful assertion rolls the fixture savepoint back.
ROLLBACK TO SAVEPOINT p0_06_storage_fixture;
RELEASE SAVEPOINT p0_06_storage_fixture;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%storage.foldername(d.name)%'
        OR COALESCE(with_check, '') ILIKE '%storage.foldername(d.name)%'
      )
  ) THEN
    RAISE EXCEPTION 'Driver-name Storage path parser reappeared during runtime proof.';
  END IF;
END;
$$;

COMMIT;
