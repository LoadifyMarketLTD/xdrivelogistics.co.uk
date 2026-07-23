#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Simulate a legacy local company and the unaudited claim created by the earlier
# compatibility backfill. The final hardening migration must remove that claim.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000004', 'legacy-owner@example.com');

INSERT INTO public.profiles (user_id)
VALUES ('00000000-0000-0000-0000-000000000004');

INSERT INTO public.companies (
  id, name, company_number, status, company_type, created_by
)
VALUES (
  '20000000-0000-0000-0000-000000000004',
  'Legacy Verified Later Limited',
  'NI765432',
  'pending_approval',
  'carrier',
  '00000000-0000-0000-0000-000000000004'
);

INSERT INTO public.company_registration_claims (
  company_number, company_id, claimed_by, registry_name, registry_status
)
VALUES (
  'NI765432',
  '20000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000004',
  'Legacy Verified Later Limited',
  'active'
);
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT_DIR/supabase/migrations/20260723205200_harden_verified_company_claims.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  legacy_result record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.company_registration_claims
    WHERE company_number = 'NI765432'
  ) THEN
    RAISE EXCEPTION 'Unaudited legacy claim survived the hardening migration.';
  END IF;

  SELECT * INTO legacy_result
  FROM public.register_validated_company_atomic(
    '00000000-0000-0000-0000-000000000004',
    'NI765432',
    'Legacy Verified Later Limited',
    'active',
    'fleet_courier'
  );

  IF NOT legacy_result.success OR legacy_result.created
     OR legacy_result.company_id <> '20000000-0000-0000-0000-000000000004'::uuid THEN
    RAISE EXCEPTION 'Provider-verified legacy reuse failed: %', row_to_json(legacy_result);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_registration_claims claim
    JOIN public.company_registration_audit audit
      ON audit.company_id = claim.company_id
     AND audit.company_number = claim.company_number
     AND audit.actor_user_id = claim.claimed_by
    WHERE claim.company_number = 'NI765432'
      AND claim.company_id = '20000000-0000-0000-0000-000000000004'::uuid
      AND claim.claimed_by = '00000000-0000-0000-0000-000000000004'::uuid
      AND audit.action = 'reused'
      AND audit.metadata->>'source' = 'companies_house_server_validation'
      AND audit.metadata->>'registry_status' = 'active'
  ) THEN
    RAISE EXCEPTION 'Verified legacy reuse did not create matching audit evidence.';
  END IF;

  -- The first validation script leaves owner A's fleet application under review.
  -- Changing its company identity while retaining a protected status must fail.
  BEGIN
    UPDATE public.onboarding_applications
    SET payload = jsonb_set(payload, '{company_number}', '"SC000000"'::jsonb)
    WHERE id = '10000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Protected onboarding identity mutation unexpectedly succeeded.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  IF has_function_privilege(
    'authenticated',
    'public.enforce_verified_company_onboarding_submission()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated role can execute the verification trigger function.';
  END IF;
END;
$$;
SQL

echo "Company registration hardening validation passed."
