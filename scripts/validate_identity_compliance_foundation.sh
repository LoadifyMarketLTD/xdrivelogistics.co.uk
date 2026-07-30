#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL database}"

MIGRATION_IDENTITY="supabase/migrations/20260729161000_identity_compliance_and_fraud_foundation.sql"
MIGRATION_QUOTES="supabase/migrations/20260729162000_marketplace_single_active_quote_per_identity.sql"

bootstrap_base_schema() {
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA auth;
CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'CREATE ROLE anon NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'CREATE ROLE service_role NOLOGIN BYPASSRLS';
  ELSE
    EXECUTE 'ALTER ROLE service_role BYPASSRLS';
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  aud text,
  role text,
  email text UNIQUE,
  encrypted_password text,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_company text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  account_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  account_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  current_step text,
  completion_percentage integer NOT NULL DEFAULT 0,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  expiry_date date
);

CREATE TABLE public.driver_identity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  doc_type text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  expiry_date date
);

CREATE TABLE public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  doc_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  rejection_reason text,
  expiry_date date
);

CREATE TABLE public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  doc_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  rejection_reason text,
  expiry_date date
);

CREATE TABLE public.owner_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  target_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  old_status text,
  new_status text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.job_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  bidder_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'submitted'
);
SQL
}

echo "==> Preflight abort proof (invalid data must fail closed)"
bootstrap_base_schema

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'preflight-conflict-user@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.companies (id, name, status, created_by)
VALUES
  ('71000000-0000-0000-0000-000000000011', 'Conflict A', 'active', '71000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000012', 'Conflict B', 'active', '71000000-0000-0000-0000-000000000001');

INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status, updated_at)
VALUES
  ('71000000-0000-0000-0000-000000000011', '71000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('71000000-0000-0000-0000-000000000012', '71000000-0000-0000-0000-000000000001', 'dispatcher', 'active', now());
SQL

set +e
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MIGRATION_IDENTITY}" > /tmp/identity-preflight-failure.log 2>&1
preflight_status=$?
set -e
if [ "${preflight_status}" -eq 0 ]; then
  echo "Expected preflight migration failure did not occur."
  cat /tmp/identity-preflight-failure.log
  exit 1
fi

grep -F "Identity compliance preflight failed: at least one user has multiple active company memberships." /tmp/identity-preflight-failure.log >/dev/null

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF to_regclass('public.company_memberships_one_active_company_per_user_uidx') IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight failure left partial index installation behind.';
  END IF;

  IF to_regclass('public.document_fingerprints') IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight failure left document_fingerprints table installed.';
  END IF;

  IF to_regprocedure('public.owner_decide_fraud_review_case(uuid, uuid, text, text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight failure left owner_decide_fraud_review_case installed.';
  END IF;
END;
$$;
SQL

echo "==> Clean migration apply and executable integration tests"
bootstrap_base_schema

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MIGRATION_IDENTITY}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MIGRATION_QUOTES}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f supabase/tests/identity_compliance_migration_preflight.sql
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f supabase/tests/identity_compliance_atomicity.sql

echo "==> Two-session duplicate SHA-256 concurrency check"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('72000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sha-owner@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sha-upload-a@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'sha-upload-b@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.profiles (user_id, status)
VALUES
  ('72000000-0000-0000-0000-000000000001', 'active'),
  ('72000000-0000-0000-0000-000000000002', 'active'),
  ('72000000-0000-0000-0000-000000000003', 'active');

INSERT INTO public.onboarding_applications (
  id, user_id, email, account_type, status, current_step,
  completion_percentage, risk_status, payload
)
VALUES
  ('72000000-0000-0000-0000-000000000101', '72000000-0000-0000-0000-000000000002', 'sha-upload-a@example.test', 'owner_driver', 'under_review', 'documents', 70, 'clear', '{}'::jsonb),
  ('72000000-0000-0000-0000-000000000102', '72000000-0000-0000-0000-000000000003', 'sha-upload-b@example.test', 'owner_driver', 'under_review', 'documents', 70, 'clear', '{}'::jsonb);

CREATE OR REPLACE FUNCTION public.test_identity_upload_concurrency(
  p_application_id uuid,
  p_subject_user_id uuid,
  p_document_id uuid,
  p_file_sha256 text
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    INSERT INTO public.document_fingerprints (
      document_family,
      document_id,
      onboarding_application_id,
      user_id,
      file_sha256
    )
    VALUES (
      'identity',
      p_document_id,
      p_application_id,
      p_subject_user_id,
      p_file_sha256
    );
    RETURN 'inserted';
  EXCEPTION
    WHEN unique_violation THEN
      PERFORM public.register_duplicate_document_fraud_case(
        p_subject_user_id,
        NULL,
        p_application_id,
        NULL,
        NULL,
        p_file_sha256,
        'proof_of_address',
        NULL,
        'identity',
        p_document_id
      );
      RETURN 'duplicate';
  END;
END;
$$;
SQL

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atc "SELECT public.test_identity_upload_concurrency('72000000-0000-0000-0000-000000000101','72000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000201','sha-concurrency-001');" > /tmp/identity-sha-a.out &
pid_sha_a=$!
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atc "SELECT public.test_identity_upload_concurrency('72000000-0000-0000-0000-000000000102','72000000-0000-0000-0000-000000000003','72000000-0000-0000-0000-000000000202','sha-concurrency-001');" > /tmp/identity-sha-b.out &
pid_sha_b=$!
wait "${pid_sha_a}"
wait "${pid_sha_b}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_fingerprint_count bigint;
  v_duplicate_case_count bigint;
  v_hold_count bigint;
BEGIN
  SELECT count(*)
  INTO v_fingerprint_count
  FROM public.document_fingerprints
  WHERE file_sha256 = 'sha-concurrency-001';

  IF v_fingerprint_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one canonical SHA-256 fingerprint row, got %.', v_fingerprint_count;
  END IF;

  SELECT count(*)
  INTO v_duplicate_case_count
  FROM public.fraud_review_cases
  WHERE case_type = 'duplicate_file'
    AND status IN ('open', 'investigating')
    AND evidence->>'file_sha256' = 'sha-concurrency-001';

  IF v_duplicate_case_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one unresolved duplicate-file fraud case, got %.', v_duplicate_case_count;
  END IF;

  SELECT count(*)
  INTO v_hold_count
  FROM public.onboarding_applications
  WHERE id IN (
      '72000000-0000-0000-0000-000000000101',
      '72000000-0000-0000-0000-000000000102'
    )
    AND risk_status = 'on_hold';

  IF v_hold_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one onboarding application to be placed on hold, got %.', v_hold_count;
  END IF;
END;
$$;
SQL

echo "==> Two-session fraud-decision race check"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('73000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'fraud-owner@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('73000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'fraud-subject@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.profiles (user_id, status)
VALUES
  ('73000000-0000-0000-0000-000000000001', 'active'),
  ('73000000-0000-0000-0000-000000000002', 'active');

INSERT INTO public.onboarding_applications (
  id, user_id, email, account_type, status, current_step,
  completion_percentage, risk_status, payload
)
VALUES (
  '73000000-0000-0000-0000-000000000101',
  '73000000-0000-0000-0000-000000000002',
  'fraud-subject@example.test',
  'owner_driver',
  'under_review',
  'risk_review',
  95,
  'review_required',
  '{}'::jsonb
);

INSERT INTO public.fraud_review_cases (
  id,
  subject_user_id,
  onboarding_application_id,
  case_type,
  severity,
  status,
  automatic_hold,
  evidence
)
VALUES (
  '73000000-0000-0000-0000-000000000102',
  '73000000-0000-0000-0000-000000000002',
  '73000000-0000-0000-0000-000000000101',
  'duplicate_file',
  'critical',
  'open',
  true,
  jsonb_build_object('file_sha256', 'fraud-decision-race-sha')
);
SQL

set +e
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atc "SELECT * FROM public.owner_decide_fraud_review_case('73000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000102','confirm','race confirm');" > /tmp/identity-fraud-confirm.out 2>&1 &
pid_case_confirm=$!
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atc "SELECT * FROM public.owner_decide_fraud_review_case('73000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000102','dismiss','race dismiss');" > /tmp/identity-fraud-dismiss.out 2>&1 &
pid_case_dismiss=$!

wait "${pid_case_confirm}"
status_confirm=$?
wait "${pid_case_dismiss}"
status_dismiss=$?
set -e

if ! { [ "${status_confirm}" -eq 0 ] && [ "${status_dismiss}" -ne 0 ]; } && \
   ! { [ "${status_confirm}" -ne 0 ] && [ "${status_dismiss}" -eq 0 ]; }; then
  echo "Expected exactly one fraud decision to succeed and one to fail."
  echo "confirm status=${status_confirm}"
  echo "dismiss status=${status_dismiss}"
  cat /tmp/identity-fraud-confirm.out || true
  cat /tmp/identity-fraud-dismiss.out || true
  exit 1
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_status text;
  v_risk_status text;
  v_app_status text;
  v_profile_status text;
  v_confirm_audit_count bigint;
  v_dismiss_audit_count bigint;
BEGIN
  SELECT status
  INTO v_status
  FROM public.fraud_review_cases
  WHERE id = '73000000-0000-0000-0000-000000000102';

  SELECT risk_status, status
  INTO v_risk_status, v_app_status
  FROM public.onboarding_applications
  WHERE id = '73000000-0000-0000-0000-000000000101';

  SELECT status
  INTO v_profile_status
  FROM public.profiles
  WHERE user_id = '73000000-0000-0000-0000-000000000002';

  SELECT count(*)
  INTO v_confirm_audit_count
  FROM public.owner_audit_log
  WHERE action_type = 'fraud_case_confirm'
    AND metadata->>'fraud_case_id' = '73000000-0000-0000-0000-000000000102';

  SELECT count(*)
  INTO v_dismiss_audit_count
  FROM public.owner_audit_log
  WHERE action_type = 'fraud_case_dismiss'
    AND metadata->>'fraud_case_id' = '73000000-0000-0000-0000-000000000102';

  IF v_status = 'confirmed' THEN
    IF v_risk_status IS DISTINCT FROM 'confirmed_fraud' OR v_app_status IS DISTINCT FROM 'rejected' THEN
      RAISE EXCEPTION 'Confirmed decision left inconsistent onboarding state. risk_status=%, app_status=%', v_risk_status, v_app_status;
    END IF;
    IF v_profile_status IS DISTINCT FROM 'blocked' THEN
      RAISE EXCEPTION 'Confirmed decision did not leave the subject profile blocked.';
    END IF;
    IF v_confirm_audit_count <> 1 OR v_dismiss_audit_count <> 0 THEN
      RAISE EXCEPTION 'Confirmed race expected one confirm audit and zero dismiss audit rows.';
    END IF;
  ELSIF v_status = 'dismissed' THEN
    IF v_risk_status IS DISTINCT FROM 'clear' THEN
      RAISE EXCEPTION 'Dismissed decision did not clear onboarding risk status.';
    END IF;
    IF v_profile_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Dismissed decision unexpectedly blocked the profile.';
    END IF;
    IF v_confirm_audit_count <> 0 OR v_dismiss_audit_count <> 1 THEN
      RAISE EXCEPTION 'Dismiss race expected one dismiss audit and zero confirm audit rows.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Fraud case ended in unexpected status after race: %', v_status;
  END IF;
END;
$$;
SQL

echo "Identity compliance migration preflight, rollback, and concurrency validation passed."
