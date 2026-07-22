-- Real-database RLS verification for notification recipient isolation.
-- Run against a disposable/local/staging database after all migrations.
-- The transaction is rolled back and leaves no fixture data behind.

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

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'notification-recipient@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'notification-peer@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'notification-inactive@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'notification-other@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'notification-none@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.companies (id, name, status, created_by)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Notification Test Company A', 'active', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Notification Test Company B', 'active', '20000000-0000-0000-0000-000000000004');

INSERT INTO public.company_memberships (
  company_id, user_id, role_in_company, status, updated_at
)
VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'member', 'active', now()),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'member', 'disabled', now()),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 'owner', 'active', now());

INSERT INTO public.notification_events (
  id, event_type, entity_type, entity_id, company_id,
  recipient_user_id, payload, status
)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'notification_rls_private_test', 'test', gen_random_uuid(),
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{}'::jsonb, 'pending'),
  ('30000000-0000-0000-0000-000000000002', 'notification_rls_broadcast_test', 'test', gen_random_uuid(),
    '10000000-0000-0000-0000-000000000001', NULL, '{}'::jsonb, 'pending');

-- Intended recipient: private + broadcast visible.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events
   WHERE id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  2,
  'Recipient visibility failed.'
);
RESET ROLE;

-- Another active member in the same company: broadcast only.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events
   WHERE id = '30000000-0000-0000-0000-000000000001'),
  0,
  'Same-company peer read a recipient-private notification.'
);
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events
   WHERE id = '30000000-0000-0000-0000-000000000002'),
  1,
  'Active member could not read the company broadcast.'
);
RESET ROLE;

-- Inactive membership: neither private nor broadcast.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events
   WHERE id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  0,
  'Inactive member read notification rows.'
);
RESET ROLE;

-- Member of another company: neither row visible.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events
   WHERE id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  0,
  'Other-company member read notification rows.'
);
RESET ROLE;

-- Authenticated non-member: neither row visible.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000005', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events
   WHERE id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  0,
  'Authenticated non-member read notification rows.'
);
RESET ROLE;

-- Unauthenticated/anon access: no SELECT policy applies.
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
SET LOCAL ROLE anon;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events
   WHERE id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  0,
  'Anonymous role read notification rows.'
);
RESET ROLE;

-- Service role retains full processing access and bypasses RLS.
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events
   WHERE id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  2,
  'Service role processing access failed.'
);
RESET ROLE;

-- Existing Web badge/count shape cannot include another user's private event.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_count(
  (SELECT count(*) FROM public.notification_events
   WHERE recipient_user_id = '20000000-0000-0000-0000-000000000002'
     AND status IN ('pending', 'failed')),
  0,
  'Badge/count query exposed another recipient private event.'
);
RESET ROLE;

ROLLBACK;
