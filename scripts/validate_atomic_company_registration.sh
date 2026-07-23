#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END;
$$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text UNIQUE
);

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_number text,
  status text NOT NULL DEFAULT 'pending_approval',
  company_type text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role_in_company text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  company_id uuid REFERENCES public.companies(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  company_id uuid REFERENCES public.companies(id),
  account_type text NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE FUNCTION public.submit_onboarding_application(p_application_id uuid)
RETURNS uuid
LANGUAGE sql
AS $$ SELECT p_application_id $$;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO authenticated, service_role;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'owner-c@example.com');
INSERT INTO public.profiles (user_id) SELECT id FROM auth.users;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT_DIR/supabase/migrations/20260723205000_atomic_authenticated_company_registration.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT_DIR/supabase/migrations/20260723205100_require_verified_company_onboarding.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  first_result record;
  retry_result record;
  takeover_result record;
  registered_company_id uuid;
BEGIN
  SELECT * INTO first_result
  FROM public.register_validated_company_atomic(
    '00000000-0000-0000-0000-000000000001',
    '01234567',
    'Example Logistics Limited',
    'active',
    'fleet_courier'
  );

  IF NOT first_result.success OR NOT first_result.created OR first_result.http_status <> 201 THEN
    RAISE EXCEPTION 'First registration failed: %', row_to_json(first_result);
  END IF;

  registered_company_id := first_result.company_id;

  SELECT * INTO retry_result
  FROM public.register_validated_company_atomic(
    '00000000-0000-0000-0000-000000000001',
    '01 234 567',
    'Example Logistics Limited',
    'active',
    'fleet_courier'
  );

  IF NOT retry_result.success OR retry_result.created OR retry_result.company_id <> registered_company_id THEN
    RAISE EXCEPTION 'Retry was not idempotent: %', row_to_json(retry_result);
  END IF;

  SELECT * INTO takeover_result
  FROM public.register_validated_company_atomic(
    '00000000-0000-0000-0000-000000000002',
    '01234567',
    'Example Logistics Limited',
    'active',
    'fleet_courier'
  );

  IF takeover_result.success OR takeover_result.error_code <> 'COMPANY_ALREADY_REGISTERED' THEN
    RAISE EXCEPTION 'Takeover attempt was not rejected: %', row_to_json(takeover_result);
  END IF;

  IF (SELECT count(*) FROM public.companies WHERE company_number = '01234567') <> 1 THEN
    RAISE EXCEPTION 'Registration created duplicate company rows.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = registered_company_id
      AND user_id = '00000000-0000-0000-0000-000000000001'
      AND role_in_company = 'owner'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Owner membership was not created.';
  END IF;

  IF (SELECT count(*) FROM public.company_registration_audit WHERE company_id = registered_company_id AND action = 'created') <> 1
     OR (SELECT count(*) FROM public.company_registration_audit WHERE company_id = registered_company_id AND action = 'reused') <> 1 THEN
    RAISE EXCEPTION 'Registration audit rows are incomplete.';
  END IF;

  INSERT INTO public.onboarding_applications (
    id, user_id, company_id, account_type, status, payload
  ) VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    registered_company_id,
    'fleet_courier',
    'draft',
    jsonb_build_object('company_number', '01234567')
  );

  UPDATE public.onboarding_applications
  SET status = 'under_review'
  WHERE id = '10000000-0000-0000-0000-000000000001';

  IF NOT EXISTS (
    SELECT 1 FROM public.onboarding_applications
    WHERE id = '10000000-0000-0000-0000-000000000001'
      AND status = 'under_review'
  ) THEN
    RAISE EXCEPTION 'Verified onboarding transition did not complete.';
  END IF;

  INSERT INTO public.onboarding_applications (
    id, user_id, company_id, account_type, status, payload
  ) VALUES (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    registered_company_id,
    'fleet_courier',
    'draft',
    jsonb_build_object('company_number', '01234567')
  );

  BEGIN
    UPDATE public.onboarding_applications
    SET status = 'under_review'
    WHERE id = '10000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'Unverified onboarding transition unexpectedly succeeded.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  IF has_function_privilege('authenticated', 'public.register_validated_company_atomic(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role can execute registration RPC.';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.register_validated_company_atomic(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Service role cannot execute registration RPC.';
  END IF;

  IF has_function_privilege('authenticated', 'public.submit_onboarding_application(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role can bypass server onboarding submission.';
  END IF;
END;
$$;
SQL

# Two concurrent requests for the same new actor/company must serialize into one
# company row and one created plus one reused audit action.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT success, created FROM public.register_validated_company_atomic('00000000-0000-0000-0000-000000000003','SC765432','Concurrent Carrier Limited','active','fleet_courier');" > /tmp/company-registration-a.out &
pid_a=$!
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT success, created FROM public.register_validated_company_atomic('00000000-0000-0000-0000-000000000003','SC765432','Concurrent Carrier Limited','active','fleet_courier');" > /tmp/company-registration-b.out &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM public.companies WHERE company_number = 'SC765432') <> 1 THEN
    RAISE EXCEPTION 'Concurrent registration created duplicate companies.';
  END IF;

  IF (SELECT count(*) FROM public.company_registration_audit audit
      JOIN public.companies company ON company.id = audit.company_id
      WHERE company.company_number = 'SC765432' AND audit.action = 'created') <> 1 THEN
    RAISE EXCEPTION 'Concurrent registration did not produce exactly one created audit row.';
  END IF;

  IF (SELECT count(*) FROM public.company_registration_audit audit
      JOIN public.companies company ON company.id = audit.company_id
      WHERE company.company_number = 'SC765432' AND audit.action = 'reused') <> 1 THEN
    RAISE EXCEPTION 'Concurrent registration did not produce exactly one reused audit row.';
  END IF;
END;
$$;
SQL

echo "Atomic company registration validation passed."
