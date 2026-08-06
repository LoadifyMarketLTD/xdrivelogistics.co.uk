-- Regression for repeated successful fraud actions that make no state change.
-- Run only on a disposable/local/staging database after applying
-- 20260806223000_audit_fraud_noop_actions.sql and
-- 20260806224500_version_audited_fraud_rpc.sql. Everything is rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert(
  p_condition boolean,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $assert$
BEGIN
  IF p_condition IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
END;
$assert$;

DO $test$
DECLARE
  v_actor_id uuid := gen_random_uuid();
  v_case_id uuid := gen_random_uuid();
  v_reason text := 'Continuing investigation with verified evidence';
  v_email text;
  v_result record;
  v_status_before text;
  v_reason_before text;
  v_updated_before timestamptz;
  v_status_after text;
  v_reason_after text;
  v_updated_after timestamptz;
  v_audit_before bigint;
  v_audit_after bigint;
  v_exact_audit_count bigint;
BEGIN
  IF to_regprocedure(
    'public.owner_decide_fraud_review_case_audited(uuid,uuid,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'owner_decide_fraud_review_case_audited(uuid, uuid, text, text) is missing.';
  END IF;

  v_email := format(
    'fraud-noop-audit-%s@example.test',
    replace(v_actor_id::text, '-', '')
  );

  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    v_actor_id,
    'authenticated',
    'authenticated',
    v_email,
    '',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  INSERT INTO public.profiles (user_id, role)
  VALUES (v_actor_id, 'owner');

  INSERT INTO public.fraud_review_cases (
    id,
    case_type,
    severity,
    status,
    automatic_hold,
    evidence,
    decision_reason,
    assigned_to,
    created_at,
    updated_at
  )
  VALUES (
    v_case_id,
    'manual_report',
    'medium',
    'investigating',
    true,
    '{}'::jsonb,
    v_reason,
    v_actor_id,
    now(),
    now()
  );

  SELECT status, decision_reason, updated_at
  INTO v_status_before, v_reason_before, v_updated_before
  FROM public.fraud_review_cases
  WHERE id = v_case_id;

  SELECT count(*)
  INTO v_audit_before
  FROM public.owner_audit_log
  WHERE target_type = 'fraud_case'
    AND target_id = v_case_id;

  SELECT *
  INTO v_result
  FROM public.owner_decide_fraud_review_case_audited(
    v_actor_id,
    v_case_id,
    'investigate',
    v_reason
  );

  PERFORM pg_temp.assert(
    v_result.case_id = v_case_id
      AND v_result.old_status = 'investigating'
      AND v_result.new_status = 'investigating',
    'Repeated investigate action did not return the expected no-state-change result.'
  );

  SELECT status, decision_reason, updated_at
  INTO v_status_after, v_reason_after, v_updated_after
  FROM public.fraud_review_cases
  WHERE id = v_case_id;

  PERFORM pg_temp.assert(
    v_status_after IS NOT DISTINCT FROM v_status_before
      AND v_reason_after IS NOT DISTINCT FROM v_reason_before
      AND v_updated_after IS NOT DISTINCT FROM v_updated_before,
    'Repeated investigate action unexpectedly changed the fraud case row.'
  );

  SELECT count(*)
  INTO v_audit_after
  FROM public.owner_audit_log
  WHERE target_type = 'fraud_case'
    AND target_id = v_case_id;

  PERFORM pg_temp.assert(
    v_audit_after = v_audit_before + 1,
    'Repeated successful fraud action must add exactly one audit record.'
  );

  SELECT count(*)
  INTO v_exact_audit_count
  FROM public.owner_audit_log
  WHERE actor_user_id = v_actor_id
    AND target_type = 'fraud_case'
    AND target_id = v_case_id
    AND target_name = format('Fraud review case %s', v_case_id)
    AND target_company_id IS NULL
    AND action_type = 'fraud_case_investigate'
    AND old_status = 'investigating'
    AND new_status = 'investigating'
    AND reason = v_reason
    AND metadata->>'fraud_case_id' = v_case_id::text
    AND metadata->>'no_state_change' = 'true'
    AND created_at IS NOT NULL;

  PERFORM pg_temp.assert(
    v_exact_audit_count = 1,
    'Repeated fraud action audit row is missing required identity, target, state, reason or no-state-change metadata.'
  );

  RAISE NOTICE 'Versioned fraud no-state-change audit regression passed.';
END;
$test$;

ROLLBACK;
