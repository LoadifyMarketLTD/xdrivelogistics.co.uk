-- Focused regression for platform-level support tickets with no company_id.
-- Run only on a disposable/local/staging database after applying
-- 20260806215000_atomic_support_ticket_audit.sql. Everything is rolled back.

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
  v_ticket_id uuid := gen_random_uuid();
  v_email text;
  v_subject text;
  v_result record;
  v_count bigint;
BEGIN
  IF to_regprocedure(
    'public.owner_update_support_ticket_with_audit(uuid,uuid,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Atomic support-ticket audit RPC is missing.';
  END IF;

  PERFORM pg_temp.assert(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'owner_audit_log'
        AND column_name = 'target_company_id'
        AND udt_name = 'uuid'
        AND is_nullable = 'YES'
    ),
    'owner_audit_log.target_company_id must be nullable for platform-level targets.'
  );

  PERFORM pg_temp.assert(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'owner_audit_log'
        AND column_name = 'metadata'
        AND udt_name = 'jsonb'
    ),
    'owner_audit_log.metadata jsonb must exist.'
  );

  v_email := format(
    'support-audit-no-company-%s@example.test',
    replace(v_actor_id::text, '-', '')
  );
  v_subject := format('Platform support ticket %s', v_ticket_id);

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
    NULL,
    v_actor_id,
    v_subject,
    'general',
    'medium',
    'open'
  );

  SELECT *
  INTO v_result
  FROM public.owner_update_support_ticket_with_audit(
    v_actor_id,
    v_ticket_id,
    'resolve',
    'Resolved platform-level support request'
  );

  PERFORM pg_temp.assert(
    v_result.ticket_id = v_ticket_id
      AND v_result.status = 'resolved'
      AND v_result.resolution_note = 'Resolved platform-level support request'
      AND v_result.resolved_at IS NOT NULL,
    'Platform-level support ticket did not resolve successfully.'
  );

  SELECT count(*)
  INTO v_count
  FROM public.owner_audit_log
  WHERE actor_user_id = v_actor_id
    AND target_type = 'support_ticket'
    AND target_id = v_ticket_id
    AND target_name = v_subject
    AND target_company_id IS NULL
    AND action_type = 'support_ticket_resolved'
    AND old_status = 'open'
    AND new_status = 'resolved'
    AND reason = 'Resolved platform-level support request'
    AND metadata->>'ticket_id' = v_ticket_id::text
    AND metadata->>'action' = 'resolve'
    AND created_at IS NOT NULL;

  PERFORM pg_temp.assert(
    v_count = 1,
    'Platform-level support ticket must create exactly one complete audit record with a null company target.'
  );

  RAISE NOTICE 'Nullable-company support-ticket audit regression passed.';
END;
$test$;

ROLLBACK;
