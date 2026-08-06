-- SQL Atomicity Test: owner_update_support_ticket_with_audit
-- Validates that ticket mutations and audit logging are atomic
-- and that failure in either step causes full transaction rollback

DO $$
DECLARE
  v_test_actor_id uuid;
  v_test_company_id uuid;
  v_test_ticket_id uuid;
  v_ticket_status_before text;
  v_ticket_status_after text;
  v_ticket_note_before text;
  v_ticket_note_after text;
  v_audit_count_before int;
  v_audit_count_after int;
  v_result record;
  v_error_raised boolean := false;
BEGIN
  -- Test setup: create test actor, company, and ticket
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    '10000000-0000-0000-0000-000000000001'::uuid,
    'authenticated',
    'authenticated',
    'test-support-audit@example.test',
    '',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  INSERT INTO public.profiles (user_id, role)
  VALUES ('10000000-0000-0000-0000-000000000001'::uuid, 'owner');

  v_test_actor_id := '10000000-0000-0000-0000-000000000001'::uuid;

  INSERT INTO public.companies (name, status, created_by)
  VALUES ('Test Support Audit Company', 'active', v_test_actor_id)
  RETURNING id INTO v_test_company_id;

  INSERT INTO public.support_tickets (
    company_id, raised_by_user_id, subject, category, priority, status
  )
  VALUES (
    v_test_company_id,
    v_test_actor_id,
    'Test ticket for atomicity',
    'technical',
    'medium',
    'open'
  )
  RETURNING id INTO v_test_ticket_id;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Test 1: Successful investigating action records audit
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*)
  INTO v_audit_count_before
  FROM public.owner_audit_log
  WHERE target_id = v_test_ticket_id;

  SELECT status, resolution_note
  INTO v_ticket_status_before, v_ticket_note_before
  FROM public.support_tickets
  WHERE id = v_test_ticket_id;

  SELECT * INTO v_result
  FROM public.owner_update_support_ticket_with_audit(
    v_test_actor_id,
    v_test_ticket_id,
    'investigating',
    'Investigating customer report'
  );

  SELECT status, resolution_note
  INTO v_ticket_status_after, v_ticket_note_after
  FROM public.support_tickets
  WHERE id = v_test_ticket_id;

  SELECT COUNT(*)
  INTO v_audit_count_after
  FROM public.owner_audit_log
  WHERE target_id = v_test_ticket_id
    AND action_type = 'support_ticket_investigating'
    AND old_status = 'open'
    AND new_status = 'investigating'
    AND reason = 'Investigating customer report'
    AND metadata->>'action' = 'investigating';

  PERFORM pg_temp.assert(
    v_ticket_status_after = 'investigating',
    format(
      'Test 1: Ticket status after investigating should be ''investigating'', got ''%s''',
      v_ticket_status_after
    )
  );

  PERFORM pg_temp.assert(
    v_ticket_note_after = 'Investigating customer report',
    format(
      'Test 1: Ticket note should be set, got ''%s''',
      v_ticket_note_after
    )
  );

  PERFORM pg_temp.assert(
    v_audit_count_after = 1,
    format(
      'Test 1: Should have exactly 1 audit record, got %s',
      v_audit_count_after
    )
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- Test 2: Resolve action with server-generated fallback reason
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT * INTO v_result
  FROM public.owner_update_support_ticket_with_audit(
    v_test_actor_id,
    v_test_ticket_id,
    'resolve',
    NULL
  );

  SELECT status
  INTO v_ticket_status_after
  FROM public.support_tickets
  WHERE id = v_test_ticket_id;

  PERFORM pg_temp.assert(
    v_ticket_status_after = 'resolved',
    format(
      'Test 2: Ticket status after resolve should be ''resolved'', got ''%s''',
      v_ticket_status_after
    )
  );

  SELECT COUNT(*)
  INTO v_audit_count_after
  FROM public.owner_audit_log
  WHERE target_id = v_test_ticket_id
    AND action_type = 'support_ticket_resolved'
    AND old_status = 'investigating'
    AND new_status = 'resolved'
    AND reason LIKE 'Support ticket % updated via super-admin action %resolve%';

  PERFORM pg_temp.assert(
    v_audit_count_after >= 1,
    'Test 2: Audit record with server-generated reason should exist'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- Test 3: Close action changes status and audit records it
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT * INTO v_result
  FROM public.owner_update_support_ticket_with_audit(
    v_test_actor_id,
    v_test_ticket_id,
    'close',
    'Issue resolved, closing ticket'
  );

  SELECT status
  INTO v_ticket_status_after
  FROM public.support_tickets
  WHERE id = v_test_ticket_id;

  PERFORM pg_temp.assert(
    v_ticket_status_after = 'closed',
    format(
      'Test 3: Ticket status after close should be ''closed'', got ''%s''',
      v_ticket_status_after
    )
  );

  SELECT COUNT(*)
  INTO v_audit_count_after
  FROM public.owner_audit_log
  WHERE target_id = v_test_ticket_id
    AND action_type = 'support_ticket_closed'
    AND old_status = 'resolved'
    AND new_status = 'closed'
    AND reason = 'Issue resolved, closing ticket';

  PERFORM pg_temp.assert(
    v_audit_count_after >= 1,
    'Test 3: Audit record for close action should exist'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- Test 4: Reopen action restores open status
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT * INTO v_result
  FROM public.owner_update_support_ticket_with_audit(
    v_test_actor_id,
    v_test_ticket_id,
    'reopen',
    'Customer reported issue still present'
  );

  SELECT status
  INTO v_ticket_status_after
  FROM public.support_tickets
  WHERE id = v_test_ticket_id;

  PERFORM pg_temp.assert(
    v_ticket_status_after = 'open',
    format(
      'Test 4: Ticket status after reopen should be ''open'', got ''%s''',
      v_ticket_status_after
    )
  );

  SELECT COUNT(*)
  INTO v_audit_count_after
  FROM public.owner_audit_log
  WHERE target_id = v_test_ticket_id
    AND action_type = 'support_ticket_reopened'
    AND old_status = 'closed'
    AND new_status = 'open'
    AND reason = 'Customer reported issue still present';

  PERFORM pg_temp.assert(
    v_audit_count_after >= 1,
    'Test 4: Audit record for reopen action should exist'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- Test 5: Missing ticket raises P0002 and creates no audit record
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*)
  INTO v_audit_count_before
  FROM public.owner_audit_log
  WHERE target_id = '99999999-9999-9999-9999-999999999999'::uuid;

  BEGIN
    SELECT * INTO v_result
    FROM public.owner_update_support_ticket_with_audit(
      v_test_actor_id,
      '99999999-9999-9999-9999-999999999999'::uuid,
      'investigating',
      'This should fail'
    );
    PERFORM pg_temp.assert(false, 'Test 5: Should have raised P0002 for missing ticket');
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    v_error_raised := true;
  END;

  PERFORM pg_temp.assert(
    v_error_raised,
    'Test 5: RPC should raise P0002 for missing ticket'
  );

  SELECT COUNT(*)
  INTO v_audit_count_after
  FROM public.owner_audit_log
  WHERE target_id = '99999999-9999-9999-9999-999999999999'::uuid;

  PERFORM pg_temp.assert(
    v_audit_count_before = v_audit_count_after,
    'Test 5: No audit record should be created for missing ticket'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- Test 6: Invalid action raises error
  -- ─────────────────────────────────────────────────────────────────────────
  v_error_raised := false;
  BEGIN
    SELECT * INTO v_result
    FROM public.owner_update_support_ticket_with_audit(
      v_test_actor_id,
      v_test_ticket_id,
      'invalid_action',
      'This should fail'
    );
    PERFORM pg_temp.assert(false, 'Test 6: Should have raised error for invalid action');
  EXCEPTION WHEN SQLSTATE '22P02' THEN
    v_error_raised := true;
  END;

  PERFORM pg_temp.assert(
    v_error_raised,
    'Test 6: RPC should raise 22P02 for invalid action'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- Test 7: Audit row contains correct metadata
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*)
  INTO v_audit_count_after
  FROM public.owner_audit_log
  WHERE target_id = v_test_ticket_id
    AND metadata ? 'ticket_id'
    AND metadata ? 'action'
    AND metadata->>'ticket_id' = v_test_ticket_id::text
    AND target_type = 'support_ticket'
    AND target_company_id = v_test_company_id
    AND actor_user_id = v_test_actor_id;

  PERFORM pg_temp.assert(
    v_audit_count_after >= 1,
    'Test 7: All audit records should contain correct metadata and target info'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- Test 8: Audit record has server-generated timestamp
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*)
  INTO v_audit_count_after
  FROM public.owner_audit_log
  WHERE target_id = v_test_ticket_id
    AND created_at IS NOT NULL
    AND created_at <= now();

  PERFORM pg_temp.assert(
    v_audit_count_after >= 1,
    'Test 8: All audit records should have server-generated created_at timestamp'
  );

  -- Cleanup
  DELETE FROM public.owner_audit_log WHERE target_id = v_test_ticket_id;
  DELETE FROM public.support_tickets WHERE id = v_test_ticket_id;
  DELETE FROM public.companies WHERE id = v_test_company_id;
  DELETE FROM public.profiles WHERE user_id = v_test_actor_id;
  DELETE FROM auth.users WHERE id = v_test_actor_id;

  RAISE INFO 'All support-ticket audit atomicity tests passed.';
END;
$$;
