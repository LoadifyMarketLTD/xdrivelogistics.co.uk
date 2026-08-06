-- Executable regression checks for the atomic support-ticket governance RPC.
-- Run only after the RPC migration on a disposable/local/staging database.
-- Every fixture and test-only constraint is rolled back at the end.

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
  v_company_id uuid := gen_random_uuid();
  v_ticket_id uuid := gen_random_uuid();
  v_missing_ticket_id uuid := gen_random_uuid();
  v_email text;
  v_subject text;
  v_result record;
  v_started_at timestamptz;
  v_count bigint;
  v_audit_before bigint;
  v_audit_after bigint;
  v_error_raised boolean;
  v_invalid_reason text;

  v_status_before text;
  v_note_before text;
  v_resolved_before timestamptz;
  v_closed_before timestamptz;
  v_updated_before timestamptz;

  v_status_after text;
  v_note_after text;
  v_resolved_after timestamptz;
  v_closed_after timestamptz;
  v_updated_after timestamptz;
BEGIN
  IF to_regprocedure(
    'public.owner_update_support_ticket_with_audit(uuid,uuid,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'owner_update_support_ticket_with_audit(uuid, uuid, text, text) is missing. Apply the proposed RPC migration only in a disposable test database before running this regression.';
  END IF;

  v_email := format(
    'support-audit-%s@example.test',
    replace(v_actor_id::text, '-', '')
  );
  v_subject := format('Atomic support ticket %s', v_ticket_id);

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

  INSERT INTO public.companies (
    id,
    name,
    status,
    created_by
  )
  VALUES (
    v_company_id,
    format('Support Audit Test Company %s', v_company_id),
    'active',
    v_actor_id
  );

  INSERT INTO public.support_tickets (
    id,
    company_id,
    raised_by_user_id,
    subject,
    category,
    priority,
    status
  )
  VALUES (
    v_ticket_id,
    v_company_id,
    v_actor_id,
    v_subject,
    'technical',
    'medium',
    'open'
  );

  -- 1. investigating: exact mutation and audit contract.
  v_started_at := clock_timestamp();

  SELECT *
  INTO v_result
  FROM public.owner_update_support_ticket_with_audit(
    v_actor_id,
    v_ticket_id,
    'investigating',
    'Investigating customer report'
  );

  PERFORM pg_temp.assert(
    v_result.ticket_id = v_ticket_id
      AND v_result.status = 'investigating'
      AND v_result.resolution_note = 'Investigating customer report',
    'Investigating RPC result does not match the expected ticket state.'
  );

  SELECT status, resolution_note, resolved_at, closed_at
  INTO v_status_after, v_note_after, v_resolved_after, v_closed_after
  FROM public.support_tickets
  WHERE id = v_ticket_id;

  PERFORM pg_temp.assert(
    v_status_after = 'investigating'
      AND v_note_after = 'Investigating customer report'
      AND v_resolved_after IS NULL
      AND v_closed_after IS NULL,
    'Investigating did not persist the expected ticket state.'
  );

  SELECT count(*)
  INTO v_count
  FROM public.owner_audit_log
  WHERE actor_user_id = v_actor_id
    AND target_type = 'support_ticket'
    AND target_id = v_ticket_id
    AND target_name = v_subject
    AND target_company_id = v_company_id
    AND action_type = 'support_ticket_investigating'
    AND old_status = 'open'
    AND new_status = 'investigating'
    AND reason = 'Investigating customer report'
    AND metadata->>'ticket_id' = v_ticket_id::text
    AND metadata->>'action' = 'investigating'
    AND created_at >= v_started_at
    AND created_at <= clock_timestamp();

  PERFORM pg_temp.assert(
    v_count = 1,
    'Investigating must create exactly one complete audit record.'
  );

  -- 2. resolve: exact canonical action type and timestamps.
  v_started_at := clock_timestamp();

  SELECT *
  INTO v_result
  FROM public.owner_update_support_ticket_with_audit(
    v_actor_id,
    v_ticket_id,
    'resolve',
    'Resolution verified by platform owner'
  );

  SELECT status, resolution_note, resolved_at, closed_at
  INTO v_status_after, v_note_after, v_resolved_after, v_closed_after
  FROM public.support_tickets
  WHERE id = v_ticket_id;

  PERFORM pg_temp.assert(
    v_result.status = 'resolved'
      AND v_status_after = 'resolved'
      AND v_note_after = 'Resolution verified by platform owner'
      AND v_resolved_after IS NOT NULL
      AND v_closed_after IS NULL,
    'Resolve did not persist the expected ticket state.'
  );

  SELECT count(*)
  INTO v_count
  FROM public.owner_audit_log
  WHERE actor_user_id = v_actor_id
    AND target_type = 'support_ticket'
    AND target_id = v_ticket_id
    AND target_name = v_subject
    AND target_company_id = v_company_id
    AND action_type = 'support_ticket_resolved'
    AND old_status = 'investigating'
    AND new_status = 'resolved'
    AND reason = 'Resolution verified by platform owner'
    AND metadata->>'ticket_id' = v_ticket_id::text
    AND metadata->>'action' = 'resolve'
    AND created_at >= v_started_at
    AND created_at <= clock_timestamp();

  PERFORM pg_temp.assert(
    v_count = 1,
    'Resolve must create exactly one complete audit record.'
  );

  -- 3. close: exact canonical action type and closed timestamp.
  v_started_at := clock_timestamp();

  SELECT *
  INTO v_result
  FROM public.owner_update_support_ticket_with_audit(
    v_actor_id,
    v_ticket_id,
    'close',
    'Issue resolved and ticket closed'
  );

  SELECT status, resolution_note, resolved_at, closed_at
  INTO v_status_after, v_note_after, v_resolved_after, v_closed_after
  FROM public.support_tickets
  WHERE id = v_ticket_id;

  PERFORM pg_temp.assert(
    v_result.status = 'closed'
      AND v_status_after = 'closed'
      AND v_note_after = 'Issue resolved and ticket closed'
      AND v_resolved_after IS NOT NULL
      AND v_closed_after IS NOT NULL,
    'Close did not persist the expected ticket state.'
  );

  SELECT count(*)
  INTO v_count
  FROM public.owner_audit_log
  WHERE actor_user_id = v_actor_id
    AND target_type = 'support_ticket'
    AND target_id = v_ticket_id
    AND target_name = v_subject
    AND target_company_id = v_company_id
    AND action_type = 'support_ticket_closed'
    AND old_status = 'resolved'
    AND new_status = 'closed'
    AND reason = 'Issue resolved and ticket closed'
    AND metadata->>'ticket_id' = v_ticket_id::text
    AND metadata->>'action' = 'close'
    AND created_at >= v_started_at
    AND created_at <= clock_timestamp();

  PERFORM pg_temp.assert(
    v_count = 1,
    'Close must create exactly one complete audit record.'
  );

  -- 4. reopen: exact canonical action type and cleared lifecycle timestamps.
  v_started_at := clock_timestamp();

  SELECT *
  INTO v_result
  FROM public.owner_update_support_ticket_with_audit(
    v_actor_id,
    v_ticket_id,
    'reopen',
    'Customer confirmed the issue remains'
  );

  SELECT status, resolution_note, resolved_at, closed_at
  INTO v_status_after, v_note_after, v_resolved_after, v_closed_after
  FROM public.support_tickets
  WHERE id = v_ticket_id;

  PERFORM pg_temp.assert(
    v_result.status = 'open'
      AND v_status_after = 'open'
      AND v_note_after = 'Customer confirmed the issue remains'
      AND v_resolved_after IS NULL
      AND v_closed_after IS NULL,
    'Reopen did not persist the expected ticket state.'
  );

  SELECT count(*)
  INTO v_count
  FROM public.owner_audit_log
  WHERE actor_user_id = v_actor_id
    AND target_type = 'support_ticket'
    AND target_id = v_ticket_id
    AND target_name = v_subject
    AND target_company_id = v_company_id
    AND action_type = 'support_ticket_reopened'
    AND old_status = 'closed'
    AND new_status = 'open'
    AND reason = 'Customer confirmed the issue remains'
    AND metadata->>'ticket_id' = v_ticket_id::text
    AND metadata->>'action' = 'reopen'
    AND created_at >= v_started_at
    AND created_at <= clock_timestamp();

  PERFORM pg_temp.assert(
    v_count = 1,
    'Reopen must create exactly one complete audit record.'
  );

  SELECT count(*)
  INTO v_count
  FROM public.owner_audit_log
  WHERE target_type = 'support_ticket'
    AND target_id = v_ticket_id;

  PERFORM pg_temp.assert(
    v_count = 4,
    'The four successful actions must create exactly four audit records.'
  );

  -- Snapshot the stable open state for all rejection/rollback checks.
  SELECT status, resolution_note, resolved_at, closed_at, updated_at
  INTO
    v_status_before,
    v_note_before,
    v_resolved_before,
    v_closed_before,
    v_updated_before
  FROM public.support_tickets
  WHERE id = v_ticket_id;

  -- 5. Missing ticket: P0002, no audit record.
  v_error_raised := false;

  BEGIN
    SELECT *
    INTO v_result
    FROM public.owner_update_support_ticket_with_audit(
      v_actor_id,
      v_missing_ticket_id,
      'investigating',
      'Valid reason for a missing ticket'
    );
  EXCEPTION
    WHEN SQLSTATE 'P0002' THEN
      v_error_raised := true;
  END;

  PERFORM pg_temp.assert(
    v_error_raised,
    'Missing ticket must raise SQLSTATE P0002.'
  );

  SELECT count(*)
  INTO v_count
  FROM public.owner_audit_log
  WHERE target_id = v_missing_ticket_id;

  PERFORM pg_temp.assert(
    v_count = 0,
    'Missing ticket must not create an audit record.'
  );

  -- 6. Invalid action: deterministic validation error and no mutation.
  SELECT count(*)
  INTO v_audit_before
  FROM public.owner_audit_log
  WHERE target_id = v_ticket_id;

  v_error_raised := false;

  BEGIN
    SELECT *
    INTO v_result
    FROM public.owner_update_support_ticket_with_audit(
      v_actor_id,
      v_ticket_id,
      'invalid_action',
      'Valid reason for invalid action'
    );
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      v_error_raised := true;
  END;

  PERFORM pg_temp.assert(
    v_error_raised,
    'Invalid action must raise SQLSTATE 23514.'
  );

  SELECT status, resolution_note, resolved_at, closed_at, updated_at
  INTO
    v_status_after,
    v_note_after,
    v_resolved_after,
    v_closed_after,
    v_updated_after
  FROM public.support_tickets
  WHERE id = v_ticket_id;

  SELECT count(*)
  INTO v_audit_after
  FROM public.owner_audit_log
  WHERE target_id = v_ticket_id;

  PERFORM pg_temp.assert(
    v_status_after IS NOT DISTINCT FROM v_status_before
      AND v_note_after IS NOT DISTINCT FROM v_note_before
      AND v_resolved_after IS NOT DISTINCT FROM v_resolved_before
      AND v_closed_after IS NOT DISTINCT FROM v_closed_before
      AND v_updated_after IS NOT DISTINCT FROM v_updated_before
      AND v_audit_after = v_audit_before,
    'Invalid action changed the ticket or audit log.'
  );

  -- 7. NULL, blank, whitespace-only and short reasons are rejected atomically.
  FOREACH v_invalid_reason IN ARRAY ARRAY[
    NULL::text,
    ''::text,
    '   '::text,
    'abcd'::text
  ]
  LOOP
    SELECT count(*)
    INTO v_audit_before
    FROM public.owner_audit_log
    WHERE target_id = v_ticket_id;

    v_error_raised := false;

    BEGIN
      SELECT *
      INTO v_result
      FROM public.owner_update_support_ticket_with_audit(
        v_actor_id,
        v_ticket_id,
        'investigating',
        v_invalid_reason
      );
    EXCEPTION
      WHEN SQLSTATE '23514' THEN
        v_error_raised := true;
    END;

    PERFORM pg_temp.assert(
      v_error_raised,
      format(
        'Invalid reason %s must raise SQLSTATE 23514.',
        quote_nullable(v_invalid_reason)
      )
    );

    SELECT status, resolution_note, resolved_at, closed_at, updated_at
    INTO
      v_status_after,
      v_note_after,
      v_resolved_after,
      v_closed_after,
      v_updated_after
    FROM public.support_tickets
    WHERE id = v_ticket_id;

    SELECT count(*)
    INTO v_audit_after
    FROM public.owner_audit_log
    WHERE target_id = v_ticket_id;

    PERFORM pg_temp.assert(
      v_status_after IS NOT DISTINCT FROM v_status_before
        AND v_note_after IS NOT DISTINCT FROM v_note_before
        AND v_resolved_after IS NOT DISTINCT FROM v_resolved_before
        AND v_closed_after IS NOT DISTINCT FROM v_closed_before
        AND v_updated_after IS NOT DISTINCT FROM v_updated_before
        AND v_audit_after = v_audit_before,
      format(
        'Invalid reason %s changed the ticket or audit log.',
        quote_nullable(v_invalid_reason)
      )
    );
  END LOOP;

  -- 8. Genuine audit-insert failure: a test-only NOT VALID constraint blocks
  -- new support-ticket audit rows. The RPC must roll back its prior ticket update.
  ALTER TABLE public.owner_audit_log
    DROP CONSTRAINT IF EXISTS test_force_support_ticket_audit_failure;

  ALTER TABLE public.owner_audit_log
    ADD CONSTRAINT test_force_support_ticket_audit_failure
    CHECK (target_type <> 'support_ticket') NOT VALID;

  SELECT status, resolution_note, resolved_at, closed_at, updated_at
  INTO
    v_status_before,
    v_note_before,
    v_resolved_before,
    v_closed_before,
    v_updated_before
  FROM public.support_tickets
  WHERE id = v_ticket_id;

  SELECT count(*)
  INTO v_audit_before
  FROM public.owner_audit_log
  WHERE target_id = v_ticket_id;

  v_error_raised := false;

  BEGIN
    SELECT *
    INTO v_result
    FROM public.owner_update_support_ticket_with_audit(
      v_actor_id,
      v_ticket_id,
      'investigating',
      'Forced audit failure rollback'
    );
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      v_error_raised := true;
  END;

  ALTER TABLE public.owner_audit_log
    DROP CONSTRAINT test_force_support_ticket_audit_failure;

  PERFORM pg_temp.assert(
    v_error_raised,
    'Forced audit insertion failure must raise SQLSTATE 23514.'
  );

  SELECT status, resolution_note, resolved_at, closed_at, updated_at
  INTO
    v_status_after,
    v_note_after,
    v_resolved_after,
    v_closed_after,
    v_updated_after
  FROM public.support_tickets
  WHERE id = v_ticket_id;

  SELECT count(*)
  INTO v_audit_after
  FROM public.owner_audit_log
  WHERE target_id = v_ticket_id;

  PERFORM pg_temp.assert(
    v_status_after IS NOT DISTINCT FROM v_status_before
      AND v_note_after IS NOT DISTINCT FROM v_note_before
      AND v_resolved_after IS NOT DISTINCT FROM v_resolved_before
      AND v_closed_after IS NOT DISTINCT FROM v_closed_before
      AND v_updated_after IS NOT DISTINCT FROM v_updated_before
      AND v_audit_after = v_audit_before,
    'Audit insertion failure did not roll back the ticket mutation atomically.'
  );

  RAISE NOTICE
    'Support-ticket audit regression passed: success paths, validation, targets, timestamps and forced audit rollback.';
END;
$test$;

ROLLBACK;
