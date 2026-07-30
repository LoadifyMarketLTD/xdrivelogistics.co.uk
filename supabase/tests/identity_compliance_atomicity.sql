-- Executable regression checks for transactional fraud decision atomicity.
-- Run only on disposable/local/staging databases.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.expect_exception(
  p_statement text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN;
  END;

  RAISE EXCEPTION '%', p_message;
END;
$$;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '65000000-0000-0000-0000-0000000000aa',
  'authenticated',
  'authenticated',
  'atomicity-owner@example.test',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

INSERT INTO public.fraud_review_cases (
  id,
  case_type,
  severity,
  status,
  automatic_hold,
  evidence
)
VALUES (
  '65000000-0000-0000-0000-000000000001',
  'manual_report',
  'high',
  'open',
  true,
  '{}'::jsonb
);

SELECT pg_temp.expect_exception(
  $sql$
  SELECT public.owner_decide_fraud_review_case(
    '66000000-0000-0000-0000-000000000001'::uuid,
    '65000000-0000-0000-0000-000000000001'::uuid,
    'investigate',
    'atomicity test: actor is intentionally invalid'
  )
  $sql$,
  'Fraud decision unexpectedly succeeded when audit insertion should fail.'
);

DO $$
DECLARE
  v_status text;
BEGIN
  SELECT status
  INTO v_status
  FROM public.fraud_review_cases
  WHERE id = '65000000-0000-0000-0000-000000000001';

  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION
      'Fraud decision was not rolled back atomically. Expected status=open, got=%.',
      v_status;
  END IF;
END;
$$;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '65000000-0000-0000-0000-0000000000bb',
  'authenticated',
  'authenticated',
  'atomicity-subject-missing-profile@example.test',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

DELETE FROM public.profiles
WHERE user_id = '65000000-0000-0000-0000-0000000000bb';

INSERT INTO public.onboarding_applications (
  id,
  user_id,
  email,
  account_type,
  status,
  current_step,
  completion_percentage,
  risk_status,
  payload
)
VALUES (
  '65000000-0000-0000-0000-000000000101',
  '65000000-0000-0000-0000-0000000000bb',
  'atomicity-subject-missing-profile@example.test',
  'owner_driver',
  'under_review',
  'pending_review',
  80,
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
  '65000000-0000-0000-0000-000000000102',
  '65000000-0000-0000-0000-0000000000bb',
  '65000000-0000-0000-0000-000000000101',
  'duplicate_file',
  'critical',
  'open',
  true,
  jsonb_build_object('file_sha256', 'atomicity-missing-profile-sha')
);

SELECT pg_temp.expect_exception(
  $sql$
  SELECT public.owner_decide_fraud_review_case(
    '65000000-0000-0000-0000-0000000000aa'::uuid,
    '65000000-0000-0000-0000-000000000102'::uuid,
    'confirm',
    'atomicity test: missing profile must abort transaction'
  )
  $sql$,
  'Fraud confirmation unexpectedly succeeded without a canonical subject profile.'
);

DO $$
DECLARE
  v_case_status text;
  v_case_decider uuid;
  v_case_decided_at timestamptz;
  v_risk_status text;
  v_app_status text;
  v_audit_count bigint;
BEGIN
  SELECT status, decided_by, decided_at
  INTO v_case_status, v_case_decider, v_case_decided_at
  FROM public.fraud_review_cases
  WHERE id = '65000000-0000-0000-0000-000000000102';

  IF v_case_status IS DISTINCT FROM 'open'
     OR v_case_decider IS NOT NULL
     OR v_case_decided_at IS NOT NULL
  THEN
    RAISE EXCEPTION
      'Fraud case state changed despite missing-profile rollback. status=%, decided_by=%, decided_at=%',
      v_case_status, v_case_decider, v_case_decided_at;
  END IF;

  SELECT risk_status, status
  INTO v_risk_status, v_app_status
  FROM public.onboarding_applications
  WHERE id = '65000000-0000-0000-0000-000000000101';

  IF v_risk_status IS DISTINCT FROM 'review_required' OR v_app_status IS DISTINCT FROM 'under_review' THEN
    RAISE EXCEPTION
      'Onboarding state changed despite missing-profile rollback. risk_status=%, status=%',
      v_risk_status, v_app_status;
  END IF;

  SELECT count(*)
  INTO v_audit_count
  FROM public.owner_audit_log
  WHERE action_type = 'fraud_case_confirm'
    AND metadata->>'fraud_case_id' = '65000000-0000-0000-0000-000000000102';

  IF v_audit_count <> 0 THEN
    RAISE EXCEPTION 'Audit rows were written despite missing-profile rollback.';
  END IF;
END;
$$;

INSERT INTO public.companies (
  id,
  name,
  status,
  created_by
)
VALUES (
  '65000000-0000-0000-0000-000000000201',
  'Atomicity Company',
  'active',
  '65000000-0000-0000-0000-0000000000aa'
);

INSERT INTO public.company_documents (
  id,
  company_id,
  doc_type,
  status
)
VALUES (
  '65000000-0000-0000-0000-000000000202',
  '65000000-0000-0000-0000-000000000201',
  'company_registration',
  'pending'
);

SELECT pg_temp.expect_exception(
  $sql$
  SELECT public.owner_review_compliance_document(
    '65000000-0000-0000-0000-000000000299'::uuid,
    'company',
    '65000000-0000-0000-0000-000000000202'::uuid,
    'approve',
    NULL
  )
  $sql$,
  'Document review unexpectedly succeeded when audit insertion should fail.'
);

DO $$
DECLARE
  v_doc_status text;
  v_audit_count bigint;
BEGIN
  SELECT status
  INTO v_doc_status
  FROM public.company_documents
  WHERE id = '65000000-0000-0000-0000-000000000202';

  IF v_doc_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION
      'Document review was not rolled back atomically. Expected status=pending, got=%.',
      v_doc_status;
  END IF;

  SELECT count(*)
  INTO v_audit_count
  FROM public.owner_audit_log
  WHERE action_type = 'document_approved'
    AND metadata->>'document_id' = '65000000-0000-0000-0000-000000000202';

  IF v_audit_count <> 0 THEN
    RAISE EXCEPTION 'Document-review audit row exists despite rollback.';
  END IF;
END;
$$;

ROLLBACK;
