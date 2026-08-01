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

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '65000000-0000-0000-0000-000000000299',
  'authenticated',
  'authenticated',
  'atomicity-compliance-reviewer@example.test',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

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

SELECT public.owner_review_compliance_document(
  '65000000-0000-0000-0000-000000000299'::uuid,
  'company',
  '65000000-0000-0000-0000-000000000202'::uuid,
  'approve',
  NULL
);

DO $$
DECLARE
  v_doc_status text;
  v_approved_audit_count bigint;
  v_approved_actor_user_id text;
  v_approved_document_family text;
  v_approved_document_id text;
  v_approved_old_status text;
  v_approved_new_status text;
  v_approved_reason text;
  v_approved_target_type text;
  v_approved_target_id text;
  v_approved_target_name text;
BEGIN
  SELECT status
  INTO v_doc_status
  FROM public.company_documents
  WHERE id = '65000000-0000-0000-0000-000000000202';

  IF v_doc_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION
      'Document review did not reach approved status. Expected status=approved, got=%.',
      v_doc_status;
  END IF;

  SELECT count(*), min(actor_user_id::text), min(metadata->>'document_family'), min(metadata->>'document_id'), min(old_status), min(new_status), min(reason), min(target_type), min(target_id::text), min(target_name)
  INTO v_approved_audit_count, v_approved_actor_user_id, v_approved_document_family, v_approved_document_id, v_approved_old_status, v_approved_new_status, v_approved_reason, v_approved_target_type, v_approved_target_id, v_approved_target_name
  FROM public.owner_audit_log
  WHERE action_type = 'document_approved'
    AND metadata->>'document_id' = '65000000-0000-0000-0000-000000000202';

  IF v_approved_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected one approved document audit row, got %.', v_approved_audit_count;
  END IF;

  IF v_approved_actor_user_id IS DISTINCT FROM '65000000-0000-0000-0000-000000000299'
     OR v_approved_document_family IS DISTINCT FROM 'company'
     OR v_approved_document_id IS DISTINCT FROM '65000000-0000-0000-0000-000000000202'
     OR v_approved_old_status IS DISTINCT FROM 'pending'
     OR v_approved_new_status IS DISTINCT FROM 'approved'
     OR COALESCE(v_approved_reason, '') = ''
     OR v_approved_target_type IS DISTINCT FROM 'compliance_document'
     OR v_approved_target_id IS DISTINCT FROM '65000000-0000-0000-0000-000000000202'
     OR COALESCE(v_approved_target_name, '') = ''
  THEN
    RAISE EXCEPTION
      'Approved document audit fields invalid. actor_user_id=%, family=%, document_id=%, old_status=%, new_status=%, reason=%, target_type=%, target_id=%, target_name=%',
      v_approved_actor_user_id, v_approved_document_family, v_approved_document_id, v_approved_old_status, v_approved_new_status, v_approved_reason, v_approved_target_type, v_approved_target_id, v_approved_target_name;
  END IF;
END;
$$;

SELECT public.owner_review_compliance_document(
  '65000000-0000-0000-0000-000000000299'::uuid,
  'company',
  '65000000-0000-0000-0000-000000000202'::uuid,
  'reject',
  'failed verification'
);

DO $$
DECLARE
  v_doc_status text;
  v_rejected_audit_count bigint;
  v_rejected_actor_user_id text;
  v_rejected_document_family text;
  v_rejected_document_id text;
  v_rejected_old_status text;
  v_rejected_new_status text;
  v_rejected_reason text;
  v_rejected_target_type text;
  v_rejected_target_id text;
  v_rejected_target_name text;
BEGIN
  SELECT status
  INTO v_doc_status
  FROM public.company_documents
  WHERE id = '65000000-0000-0000-0000-000000000202';

  IF v_doc_status IS DISTINCT FROM 'rejected' THEN
    RAISE EXCEPTION
      'Document review did not reach rejected status. Expected status=rejected, got=%.',
      v_doc_status;
  END IF;

  SELECT count(*), min(actor_user_id::text), min(metadata->>'document_family'), min(metadata->>'document_id'), min(old_status), min(new_status), min(reason), min(target_type), min(target_id::text), min(target_name)
  INTO v_rejected_audit_count, v_rejected_actor_user_id, v_rejected_document_family, v_rejected_document_id, v_rejected_old_status, v_rejected_new_status, v_rejected_reason, v_rejected_target_type, v_rejected_target_id, v_rejected_target_name
  FROM public.owner_audit_log
  WHERE action_type = 'document_rejected'
    AND metadata->>'document_id' = '65000000-0000-0000-0000-000000000202';

  IF v_rejected_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected one rejected document audit row, got %.', v_rejected_audit_count;
  END IF;

  IF v_rejected_actor_user_id IS DISTINCT FROM '65000000-0000-0000-0000-000000000299'
     OR v_rejected_document_family IS DISTINCT FROM 'company'
     OR v_rejected_document_id IS DISTINCT FROM '65000000-0000-0000-0000-000000000202'
     OR v_rejected_old_status IS DISTINCT FROM 'approved'
     OR v_rejected_new_status IS DISTINCT FROM 'rejected'
     OR v_rejected_reason IS DISTINCT FROM 'failed verification'
     OR v_rejected_target_type IS DISTINCT FROM 'compliance_document'
     OR v_rejected_target_id IS DISTINCT FROM '65000000-0000-0000-0000-000000000202'
     OR COALESCE(v_rejected_target_name, '') = ''
  THEN
    RAISE EXCEPTION
      'Rejected document audit fields invalid. actor_user_id=%, family=%, document_id=%, old_status=%, new_status=%, reason=%, target_type=%, target_id=%, target_name=%',
      v_rejected_actor_user_id, v_rejected_document_family, v_rejected_document_id, v_rejected_old_status, v_rejected_new_status, v_rejected_reason, v_rejected_target_type, v_rejected_target_id, v_rejected_target_name;
  END IF;
END;
$$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS exchange_visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS exchange_posted_at timestamptz;

INSERT INTO public.companies (
  id,
  name,
  status,
  created_by
)
VALUES (
  '65000000-0000-0000-0000-000000000501',
  'Atomicity Marketplace Company',
  'active',
  '65000000-0000-0000-0000-0000000000aa'
);

INSERT INTO public.jobs (
  id,
  created_by,
  company_id,
  status,
  exchange_visibility
)
VALUES (
  '65000000-0000-0000-0000-000000000502',
  '65000000-0000-0000-0000-0000000000aa',
  '65000000-0000-0000-0000-000000000501',
  'draft',
  'private'
);

SELECT public.apply_marketplace_governance_action(
  '65000000-0000-0000-0000-0000000000aa'::uuid,
  '65000000-0000-0000-0000-000000000502'::uuid,
  'publish_to_exchange',
  'atomicity marketplace publish'
);

DO $$
DECLARE
  v_job_status text;
  v_job_visibility text;
  v_job_posted_at timestamptz;
  v_audit_count bigint;
  v_actor_user_id text;
  v_target_type text;
  v_target_id text;
  v_target_name text;
  v_target_company_id text;
  v_action_type text;
  v_old_status text;
  v_new_status text;
  v_reason text;
BEGIN
  SELECT status, exchange_visibility, exchange_posted_at
  INTO v_job_status, v_job_visibility, v_job_posted_at
  FROM public.jobs
  WHERE id = '65000000-0000-0000-0000-000000000502';

  IF v_job_status IS DISTINCT FROM 'draft'
     OR v_job_visibility IS DISTINCT FROM 'exchange'
     OR v_job_posted_at IS NULL
  THEN
    RAISE EXCEPTION
      'Marketplace publish did not persist expected job state. status=%, exchange_visibility=%, exchange_posted_at=%',
      v_job_status, v_job_visibility, v_job_posted_at;
  END IF;

  SELECT count(*), min(actor_user_id::text), min(target_type), min(target_id::text), min(target_name), min(target_company_id::text), min(action_type), min(old_status), min(new_status), min(reason)
  INTO v_audit_count, v_actor_user_id, v_target_type, v_target_id, v_target_name, v_target_company_id, v_action_type, v_old_status, v_new_status, v_reason
  FROM public.owner_audit_log
  WHERE action_type = 'marketplace_published'
    AND target_id = '65000000-0000-0000-0000-000000000502'::uuid;

  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected one marketplace audit row, got %.', v_audit_count;
  END IF;

  IF v_actor_user_id IS DISTINCT FROM '65000000-0000-0000-0000-0000000000aa'
     OR v_target_type IS DISTINCT FROM 'job'
     OR v_target_id IS DISTINCT FROM '65000000-0000-0000-0000-000000000502'
     OR v_target_name IS DISTINCT FROM 'Marketplace job 65000000-0000-0000-0000-000000000502'
     OR v_target_company_id IS DISTINCT FROM '65000000-0000-0000-0000-000000000501'
     OR v_action_type IS DISTINCT FROM 'marketplace_published'
     OR v_old_status IS DISTINCT FROM 'visibility:private'
     OR v_new_status IS DISTINCT FROM 'visibility:exchange'
     OR v_reason IS DISTINCT FROM 'atomicity marketplace publish'
  THEN
    RAISE EXCEPTION
      'Marketplace audit fields invalid. actor_user_id=%, target_type=%, target_id=%, target_name=%, target_company_id=%, action_type=%, old_status=%, new_status=%, reason=%',
      v_actor_user_id, v_target_type, v_target_id, v_target_name, v_target_company_id, v_action_type, v_old_status, v_new_status, v_reason;
  END IF;
END;
$$;

INSERT INTO public.jobs (
  id,
  created_by,
  company_id,
  status,
  exchange_visibility
)
VALUES (
  '65000000-0000-0000-0000-000000000503',
  '65000000-0000-0000-0000-0000000000aa',
  '65000000-0000-0000-0000-000000000501',
  'draft',
  'private'
);

SELECT pg_temp.expect_exception(
  $sql$
  SELECT public.apply_marketplace_governance_action(
    '66000000-0000-0000-0000-000000000001'::uuid,
    '65000000-0000-0000-0000-000000000503'::uuid,
    'publish_to_exchange',
    'atomicity marketplace invalid actor'
  )
  $sql$,
  'Marketplace governance unexpectedly succeeded when audit insertion should fail.'
);

DO $$
DECLARE
  v_job_status text;
  v_job_visibility text;
  v_job_posted_at timestamptz;
  v_audit_count bigint;
BEGIN
  SELECT status, exchange_visibility, exchange_posted_at
  INTO v_job_status, v_job_visibility, v_job_posted_at
  FROM public.jobs
  WHERE id = '65000000-0000-0000-0000-000000000503';

  IF v_job_status IS DISTINCT FROM 'draft'
     OR v_job_visibility IS DISTINCT FROM 'private'
     OR v_job_posted_at IS NOT NULL
  THEN
    RAISE EXCEPTION
      'Marketplace governance was not rolled back atomically. status=%, exchange_visibility=%, exchange_posted_at=%',
      v_job_status, v_job_visibility, v_job_posted_at;
  END IF;

  SELECT count(*)
  INTO v_audit_count
  FROM public.owner_audit_log
  WHERE target_id = '65000000-0000-0000-0000-000000000503'::uuid;

  IF v_audit_count <> 0 THEN
    RAISE EXCEPTION 'Marketplace audit rows were written despite rollback.';
  END IF;
END;
$$;

UPDATE public.compliance_document_requirements
SET required = false
WHERE account_type = 'individual_driver';

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('65000000-0000-0000-0000-0000000000cc', 'authenticated', 'authenticated', 'atomicity-actor-company-driver@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('65000000-0000-0000-0000-0000000000cd', 'authenticated', 'authenticated', 'atomicity-company-driver@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.companies (
  id,
  name,
  status,
  created_by
)
VALUES (
  '65000000-0000-0000-0000-000000000301',
  'Atomicity Company Driver Fleet',
  'pending',
  '65000000-0000-0000-0000-0000000000cc'
);

INSERT INTO public.company_memberships (
  company_id,
  user_id,
  role_in_company,
  status,
  updated_at
)
VALUES (
  '65000000-0000-0000-0000-000000000301',
  '65000000-0000-0000-0000-0000000000cd',
  'member',
  'invited',
  now()
);

INSERT INTO public.onboarding_applications (
  id,
  user_id,
  email,
  account_type,
  status,
  current_step,
  completion_percentage,
  risk_status,
  company_id,
  payload
)
VALUES (
  '65000000-0000-0000-0000-000000000302',
  '65000000-0000-0000-0000-0000000000cd',
  'atomicity-company-driver@example.test',
  'individual_driver',
  'under_review',
  'pending_review',
  90,
  'clear',
  '65000000-0000-0000-0000-000000000301',
  jsonb_build_object('full_name', 'Atomicity Company Driver', 'phone', '+447700900001')
);

UPDATE public.onboarding_applications
SET status = 'approved',
    risk_reviewed_by = '65000000-0000-0000-0000-0000000000cc'::uuid,
    reviewed_at = now(),
    reviewed_by = '65000000-0000-0000-0000-0000000000cc'::uuid,
    review_notes = 'atomicity: invited company driver approval'
WHERE id = '65000000-0000-0000-0000-000000000302'::uuid;

DO $$
DECLARE
  v_role text;
  v_status text;
BEGIN
  SELECT role_in_company::text, status::text
  INTO v_role, v_status
  FROM public.company_memberships
  WHERE company_id = '65000000-0000-0000-0000-000000000301'
    AND user_id = '65000000-0000-0000-0000-0000000000cd';

  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION
      'Company Driver approval did not activate membership. status=%',
      v_status;
  END IF;

  IF v_role = 'owner' THEN
    RAISE EXCEPTION
      'Company Driver approval incorrectly granted owner role.';
  END IF;
END;
$$;

UPDATE public.compliance_document_requirements
SET required = false
WHERE account_type = 'individual_driver';

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('65000000-0000-0000-0000-0000000000ce', 'authenticated', 'authenticated', 'atomicity-company-owner@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('65000000-0000-0000-0000-0000000000cf', 'authenticated', 'authenticated', 'atomicity-company-invited-driver@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.companies (
  id,
  name,
  status,
  created_by
)
VALUES (
  '65000000-0000-0000-0000-000000000401',
  'Atomicity Compliance Fleet',
  'pending',
  '65000000-0000-0000-0000-0000000000ce'
);

INSERT INTO public.onboarding_applications (
  id,
  user_id,
  email,
  account_type,
  status,
  current_step,
  completion_percentage,
  risk_status,
  company_id,
  created_at,
  payload
)
VALUES (
  '65000000-0000-0000-0000-000000000402',
  '65000000-0000-0000-0000-0000000000ce',
  'atomicity-company-owner@example.test',
  'fleet_courier',
  'under_review',
  'documents',
  100,
  'clear',
  '65000000-0000-0000-0000-000000000401',
  now() - interval '2 days',
  '{}'::jsonb
);

INSERT INTO public.onboarding_applications (
  id,
  user_id,
  email,
  account_type,
  status,
  current_step,
  completion_percentage,
  risk_status,
  company_id,
  created_at,
  payload
)
VALUES (
  '65000000-0000-0000-0000-000000000403',
  '65000000-0000-0000-0000-0000000000cf',
  'atomicity-company-invited-driver@example.test',
  'individual_driver',
  'under_review',
  'documents',
  30,
  'clear',
  '65000000-0000-0000-0000-000000000401',
  now(),
  '{}'::jsonb
);

INSERT INTO public.company_documents (
  id,
  company_id,
  onboarding_application_id,
  doc_type,
  status,
  file_path
)
VALUES
  ('65000000-0000-0000-0000-000000000411', '65000000-0000-0000-0000-000000000401', '65000000-0000-0000-0000-000000000402', 'company_registration', 'approved', 'test/company_registration.pdf'),
  ('65000000-0000-0000-0000-000000000412', '65000000-0000-0000-0000-000000000401', '65000000-0000-0000-0000-000000000402', 'public_liability', 'approved', 'test/public_liability.pdf'),
  ('65000000-0000-0000-0000-000000000413', '65000000-0000-0000-0000-000000000401', '65000000-0000-0000-0000-000000000402', 'goods_in_transit', 'approved', 'test/goods_in_transit.pdf'),
  ('65000000-0000-0000-0000-000000000414', '65000000-0000-0000-0000-000000000401', '65000000-0000-0000-0000-000000000402', 'vehicle_insurance', 'approved', 'test/vehicle_insurance.pdf');

DO $$
BEGIN
  PERFORM public.assert_company_compliance_ready('65000000-0000-0000-0000-000000000401'::uuid);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION
      'Company activation gate selected the wrong onboarding subject: %',
      SQLERRM;
END;
$$;

-- ── owner_decide_fraud_review_case: success path audit-target verification ────
--
-- Verifies that after migration 20260801210000 the function:
--   (a) succeeds for action='investigate'
--   (b) writes an owner_audit_log row with target_type = 'fraud_case'
--   (c) writes target_id  = the case UUID
--   (d) writes target_name derived from the case UUID
--   (e) does NOT write target_type = NULL

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '65000000-0000-0000-0000-0000000000d0',
  'authenticated',
  'authenticated',
  'fraud-audit-target-actor@example.test',
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
  '65000000-0000-0000-0000-000000000501',
  'manual_report',
  'medium',
  'open',
  false,
  '{}'::jsonb
);

DO $$
DECLARE
  v_case_id           uuid := '65000000-0000-0000-0000-000000000501';
  v_actor_id          uuid := '65000000-0000-0000-0000-0000000000d0';
  v_audit_count       bigint;
  v_target_type       text;
  v_target_id         uuid;
  v_target_name       text;
  v_action_type       text;
  v_new_status        text;
BEGIN
  -- Call the function under test
  SELECT new_status
  INTO v_new_status
  FROM public.owner_decide_fraud_review_case(
    v_actor_id,
    v_case_id,
    'investigate',
    'audit-target regression test'
  );

  IF v_new_status IS DISTINCT FROM 'investigating' THEN
    RAISE EXCEPTION
      'owner_decide_fraud_review_case returned unexpected new_status=%. Expected investigating.',
      v_new_status;
  END IF;

  -- Verify audit log row
  SELECT count(*), min(target_type), min(target_id), min(target_name), min(action_type)
  INTO v_audit_count, v_target_type, v_target_id, v_target_name, v_action_type
  FROM public.owner_audit_log
  WHERE actor_user_id = v_actor_id
    AND action_type = 'fraud_case_investigate';

  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 audit row for fraud_case_investigate, got %.',
      v_audit_count;
  END IF;

  IF v_target_type IS DISTINCT FROM 'fraud_case' THEN
    RAISE EXCEPTION
      'owner_audit_log.target_type = %, expected fraud_case. Migration 20260801210000 may not have been applied.',
      v_target_type;
  END IF;

  IF v_target_id IS DISTINCT FROM v_case_id THEN
    RAISE EXCEPTION
      'owner_audit_log.target_id = %, expected %.',
      v_target_id, v_case_id;
  END IF;

  IF v_target_name NOT LIKE '%' || v_case_id::text || '%' THEN
    RAISE EXCEPTION
      'owner_audit_log.target_name = %, expected a value containing the case UUID %.',
      v_target_name, v_case_id;
  END IF;

  RAISE NOTICE
    'owner_decide_fraud_review_case audit-target verification passed: target_type=%, target_id=%, action_type=%',
    v_target_type, v_target_id, v_action_type;
END;
$$;

ROLLBACK;
