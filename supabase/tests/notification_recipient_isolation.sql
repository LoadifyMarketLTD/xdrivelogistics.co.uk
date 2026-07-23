-- Real-database RLS verification for notification recipient isolation.
-- Run after all migrations against a disposable/local/staging database.
-- The transaction is always rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_count(
  p_actual bigint,
  p_expected bigint,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '% Expected %, got %.', p_message, p_expected, p_actual;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(
  p_condition boolean,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
END;
$$;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'notification-recipient@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'notification-peer@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'notification-inactive@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'notification-other@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'notification-none@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'notification-suspended-company@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.companies (id, name, status, created_by)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Notification Test Company A', 'active', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Notification Test Company B', 'active', '20000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000003', 'Notification Suspended Company', 'suspended', '20000000-0000-0000-0000-000000000006');

INSERT INTO public.company_memberships (
  company_id, user_id, role_in_company, status, updated_at
)
VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'viewer', 'active', now()),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'viewer', 'disabled', now()),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 'owner', 'active', now()),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000006', 'owner', 'active', now());

INSERT INTO public.notification_events (
  id, event_type, entity_type, entity_id, company_id,
  recipient_user_id, payload, status
)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'notification_rls_private_recipient', 'test', gen_random_uuid(),
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{}'::jsonb, 'pending'),
  ('30000000-0000-0000-0000-000000000002', 'notification_rls_private_peer', 'test', gen_random_uuid(),
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '{}'::jsonb, 'failed'),
  ('30000000-0000-0000-0000-000000000003', 'notification_rls_company_broadcast', 'test', gen_random_uuid(),
    '10000000-0000-0000-0000-000000000001', NULL, '{}'::jsonb, 'pending'),
  ('30000000-0000-0000-0000-000000000004', 'notification_rls_suspended_broadcast', 'test', gen_random_uuid(),
    '10000000-0000-0000-0000-000000000003', NULL, '{}'::jsonb, 'pending'),
  ('30000000-0000-0000-0000-000000000005', 'notification_rls_private_no_company', 'test', gen_random_uuid(),
    NULL, '20000000-0000-0000-0000-000000000001', '{}'::jsonb, 'pending');

SELECT pg_temp.assert_count(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_events'
      AND policyname = 'notification_events_select_company'
  ),
  0,
  'Legacy company-wide notification policy still exists.'
);

SELECT pg_temp.assert_count(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_events'
      AND policyname = 'notification_events_select_recipient_or_company_broadcast'
  ),
  1,
  'Canonical notification SELECT policy is missing or duplicated.'
);

SELECT pg_temp.assert_true(
  (
    SELECT position('recipient_user_id' in qual) > 0
       AND position('is_company_member' in qual) > 0
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_events'
      AND policyname = 'notification_events_select_recipient_or_company_broadcast'
  ),
  'Canonical policy does not contain both recipient and active-company membership guards.'
);

SELECT pg_temp.assert_true(
  to_regprocedure('public.notification_has_active_company_membership(uuid)') IS NULL,
  'Superseded notification membership helper still exists.'
);

SELECT pg_temp.assert_true(
  NOT has_table_privilege('anon', 'public.notification_events', 'SELECT'),
  'Anonymous role unexpectedly has SELECT privilege on notification_events.'
);

SELECT pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.notification_events', 'SELECT'),
  'Authenticated role is missing SELECT privilege required for RLS-filtered reads.'
);

SELECT pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.is_company_member(uuid)', 'EXECUTE'),
  'Authenticated role cannot execute the canonical membership helper.'
);

-- Intended recipient: own private rows plus active-company broadcast, but never peer private rows.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events),
  3,
  'Recipient visibility did not include exactly own private rows and active-company broadcast.'
);
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events WHERE id = '30000000-0000-0000-0000-000000000002'),
  0,
  'Recipient read a peer private notification.'
);
SELECT pg_temp.assert_count(
  (
    SELECT count(*)
    FROM public.notification_events
    WHERE company_id = '10000000-0000-0000-0000-000000000001'
  ),
  2,
  'Company-filtered notification query returned the wrong recipient/broadcast set.'
);
RESET ROLE;

-- Same-company peer: own private row plus company broadcast, never the recipient's row.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events),
  2,
  'Same-company peer did not receive exactly own private row and company broadcast.'
);
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events WHERE id = '30000000-0000-0000-0000-000000000001'),
  0,
  'Same-company peer read another recipient private notification.'
);
SELECT pg_temp.assert_count(
  (
    SELECT count(*)
    FROM public.notification_events
    WHERE recipient_user_id = '20000000-0000-0000-0000-000000000002'
      AND status IN ('pending', 'failed')
  ),
  1,
  'Badge/count query returned another user private event or missed the peer event.'
);
RESET ROLE;

-- Disabled membership cannot read broadcasts.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events),
  0,
  'Inactive member read notification rows.'
);
RESET ROLE;

-- A member of another tenant cannot read company A rows.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events),
  0,
  'Other-company member read notification rows.'
);
RESET ROLE;

-- Authenticated user with no membership and no direct private row sees nothing.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000005', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events),
  0,
  'Authenticated non-member read notification rows.'
);
RESET ROLE;

-- Active membership in a suspended company is not enough for a broadcast read.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000006', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events),
  0,
  'Member of a suspended company read its broadcast.'
);
RESET ROLE;

-- Provider processing keeps service-role access to the complete queue.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('role', 'service_role')::text,
  true
);
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events),
  5,
  'Service-role queue processing access failed.'
);
RESET ROLE;

ROLLBACK;
