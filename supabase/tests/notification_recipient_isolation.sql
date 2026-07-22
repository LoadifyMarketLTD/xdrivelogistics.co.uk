-- Real-database RLS verification for notification recipient isolation.
-- Run against a disposable/local/staging database after all migrations.
-- The transaction is rolled back and leaves no fixture data behind.

BEGIN;

DO $$
DECLARE
  v_company_a uuid := '10000000-0000-0000-0000-000000000001';
  v_company_b uuid := '10000000-0000-0000-0000-000000000002';
  v_recipient uuid := '20000000-0000-0000-0000-000000000001';
  v_same_company_member uuid := '20000000-0000-0000-0000-000000000002';
  v_inactive_member uuid := '20000000-0000-0000-0000-000000000003';
  v_other_company_member uuid := '20000000-0000-0000-0000-000000000004';
  v_non_member uuid := '20000000-0000-0000-0000-000000000005';
  v_private_event uuid := '30000000-0000-0000-0000-000000000001';
  v_broadcast_event uuid := '30000000-0000-0000-0000-000000000002';
  v_visible integer;
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (v_recipient, 'authenticated', 'authenticated', 'notification-recipient@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_same_company_member, 'authenticated', 'authenticated', 'notification-peer@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_inactive_member, 'authenticated', 'authenticated', 'notification-inactive@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_other_company_member, 'authenticated', 'authenticated', 'notification-other@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_non_member, 'authenticated', 'authenticated', 'notification-none@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.companies (id, name, status, created_by)
  VALUES
    (v_company_a, 'Notification Test Company A', 'active', v_recipient),
    (v_company_b, 'Notification Test Company B', 'active', v_other_company_member);

  INSERT INTO public.company_memberships (
    company_id, user_id, role_in_company, status, updated_at
  )
  VALUES
    (v_company_a, v_recipient, 'owner', 'active', now()),
    (v_company_a, v_same_company_member, 'member', 'active', now()),
    (v_company_a, v_inactive_member, 'member', 'disabled', now()),
    (v_company_b, v_other_company_member, 'owner', 'active', now());

  INSERT INTO public.notification_events (
    id, event_type, entity_type, entity_id, company_id,
    recipient_user_id, payload, status
  )
  VALUES
    (v_private_event, 'notification_rls_private_test', 'test', gen_random_uuid(), v_company_a,
      v_recipient, '{}'::jsonb, 'pending'),
    (v_broadcast_event, 'notification_rls_broadcast_test', 'test', gen_random_uuid(), v_company_a,
      NULL, '{}'::jsonb, 'pending');

  -- Intended recipient: private + broadcast visible.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_recipient, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_visible
  FROM public.notification_events
  WHERE id IN (v_private_event, v_broadcast_event);
  IF v_visible <> 2 THEN
    RAISE EXCEPTION 'Recipient expected 2 visible notifications, got %', v_visible;
  END IF;
  RESET ROLE;

  -- Another active member in the same company: broadcast only.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_same_company_member, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_visible
  FROM public.notification_events
  WHERE id = v_private_event;
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'Same-company peer could read recipient-private notification';
  END IF;
  SELECT count(*) INTO v_visible
  FROM public.notification_events
  WHERE id = v_broadcast_event;
  IF v_visible <> 1 THEN
    RAISE EXCEPTION 'Active member could not read company broadcast';
  END IF;
  RESET ROLE;

  -- Inactive membership: neither private nor broadcast.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_inactive_member, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_visible
  FROM public.notification_events
  WHERE id IN (v_private_event, v_broadcast_event);
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'Inactive member could read notification rows';
  END IF;
  RESET ROLE;

  -- Member of another company: neither row visible.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other_company_member, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_visible
  FROM public.notification_events
  WHERE id IN (v_private_event, v_broadcast_event);
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'Other-company member could read notification rows';
  END IF;
  RESET ROLE;

  -- Authenticated non-member: neither row visible.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_non_member, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_visible
  FROM public.notification_events
  WHERE id IN (v_private_event, v_broadcast_event);
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'Non-member could read notification rows';
  END IF;
  RESET ROLE;

  -- Unauthenticated/anon access is rejected by the absence of a SELECT policy.
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_visible
  FROM public.notification_events
  WHERE id IN (v_private_event, v_broadcast_event);
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'Anonymous role could read notification rows';
  END IF;
  RESET ROLE;

  -- Service role retains full processing access and bypasses RLS.
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO v_visible
  FROM public.notification_events
  WHERE id IN (v_private_event, v_broadcast_event);
  IF v_visible <> 2 THEN
    RAISE EXCEPTION 'Service role expected 2 visible notifications, got %', v_visible;
  END IF;
  RESET ROLE;

  -- Badge/count shape: peer user must not count another recipient's private row.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_same_company_member, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_visible
  FROM public.notification_events
  WHERE recipient_user_id = v_same_company_member
    AND status IN ('pending', 'failed');
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'Badge/count query exposed another recipient private event';
  END IF;
  RESET ROLE;
END;
$$;

ROLLBACK;
