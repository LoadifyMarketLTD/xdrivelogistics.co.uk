\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'owner-lifecycle@example.test',
    crypt('TestPassword123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"owner"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'customer-lifecycle@example.test',
    crypt('TestPassword123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"account_type":"customer","requested_role":"customer","signup_type":"customer","role":"customer"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'broker-lifecycle@example.test',
    crypt('TestPassword123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"account_type":"broker","requested_role":"broker","signup_type":"broker","role":"broker"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'fleet-lifecycle@example.test',
    crypt('TestPassword123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"account_type":"fleet_operator","requested_role":"fleet_operator","signup_type":"fleet_operator","role":"company_admin"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'owner-driver-lifecycle@example.test',
    crypt('TestPassword123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"account_type":"owner_driver","requested_role":"owner_driver","signup_type":"owner_driver","role":"driver","owner_driver_workspace":true}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'unknown-lifecycle@example.test',
    crypt('TestPassword123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"mystery_role"}'::jsonb,
    now(), now()
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '10000000-0000-0000-0000-000000000006'
  ) THEN
    RAISE EXCEPTION 'Unknown auth metadata was silently provisioned as a profile.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id IN (
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000005'
    )
      AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'A public signup was activated before onboarding.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND role = 'owner'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'The platform owner trigger contract is invalid.';
  END IF;
END;
$$;

INSERT INTO public.onboarding_applications (
  id,
  user_id,
  email,
  account_type,
  workspace_mode,
  owner_driver_workspace,
  status,
  token_hash,
  token_expires_at,
  current_step,
  completion_percentage,
  payload,
  created_at,
  updated_at,
  last_activity_at
)
VALUES
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'customer-lifecycle@example.test',
    'customer_shipper', 'customer', false, 'in_progress',
    encode(digest('customer-token', 'sha256'), 'hex'), now() + interval '24 hours',
    'review_summary', 100,
    '{"full_name":"Customer Lifecycle","contact_email":"customer-lifecycle@example.test","contact_phone":"","company_name":"Customer Lifecycle Ltd","billing_address":"1 Customer Street"}'::jsonb,
    now(), now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    'broker-lifecycle@example.test',
    'broker_shipper', 'broker', false, 'in_progress',
    encode(digest('broker-token', 'sha256'), 'hex'), now() + interval '24 hours',
    'review_summary', 100,
    '{"company_name":"Broker Lifecycle Ltd","trading_name":"Broker Lifecycle","company_number":"12345678","vat_number":"GB123456789","billing_address":"2 Broker Street","trading_address":"2 Broker Street","contact_person":"Broker Contact","finance_contact":"Finance Contact","contact_email":"broker-lifecycle@example.test","contact_phone":"07111111111"}'::jsonb,
    now(), now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    'fleet-lifecycle@example.test',
    'fleet_courier', 'company', false, 'in_progress',
    encode(digest('fleet-token', 'sha256'), 'hex'), now() + interval '24 hours',
    'review_summary', 100,
    '{"legal_company_name":"Fleet Lifecycle Ltd","trading_name":"Fleet Lifecycle","company_number":"87654321","vat_number":"GB987654321","registered_address":"3 Fleet Street","trading_address":"3 Fleet Street","contact_person":"Fleet Contact","compliance_contact":"Compliance Contact","transport_contact":"Transport Contact"}'::jsonb,
    now(), now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    'owner-driver-lifecycle@example.test',
    'owner_driver', 'owner_driver', true, 'in_progress',
    encode(digest('owner-driver-token', 'sha256'), 'hex'), now() + interval '24 hours',
    'review_summary', 100,
    '{"full_name":"Owner Driver Lifecycle","date_of_birth":"1990-01-15","nationality":"British","address":"4 Driver Street","contact_phone":"07222222222","contact_email":"owner-driver-lifecycle@example.test","national_insurance_number":"QQ123456C","right_to_work_status":"settled","licence_number":"TEST123456789","licence_expiry":"2030-01-15","registration":"AB12 CDE","make":"Mercedes-Benz","model":"Sprinter","payload":"1000 kg","dimensions":"4m x 2m x 2m","settled_status":true,"pre_settled_status":false}'::jsonb,
    now(), now(), now()
  );

SELECT public.submit_onboarding_application('20000000-0000-0000-0000-000000000002');
SELECT public.submit_onboarding_application('20000000-0000-0000-0000-000000000003');
SELECT public.submit_onboarding_application('20000000-0000-0000-0000-000000000004');
SELECT public.submit_onboarding_application('20000000-0000-0000-0000-000000000005');

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications a
    JOIN public.profiles p ON p.user_id = a.user_id
    JOIN public.companies c ON c.id = a.company_id
    JOIN public.company_memberships cm ON cm.company_id = c.id AND cm.user_id = a.user_id
    WHERE a.id = '20000000-0000-0000-0000-000000000002'
      AND a.status = 'approved'
      AND p.role = 'customer'
      AND p.status = 'active'
      AND c.status::text = 'active'
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Customer submission did not unlock the Customer workspace atomically.';
  END IF;

  FOREACH v_user_id IN ARRAY ARRAY[
    '10000000-0000-0000-0000-000000000003'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    '10000000-0000-0000-0000-000000000005'::uuid
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.onboarding_applications a
      JOIN public.profiles p ON p.user_id = a.user_id
      JOIN public.companies c ON c.id = a.company_id
      JOIN public.company_memberships cm ON cm.company_id = c.id AND cm.user_id = a.user_id
      WHERE a.user_id = v_user_id
        AND a.status = 'under_review'
        AND p.status = 'pending'
        AND c.status::text = 'pending_approval'
        AND cm.status = 'invited'
    ) THEN
      RAISE EXCEPTION 'Review submission activated access for user %.', v_user_id;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.user_id = '10000000-0000-0000-0000-000000000005'
      AND d.app_access = false
  ) THEN
    RAISE EXCEPTION 'Owner Driver received app access before approval.';
  END IF;
END;
$$;

SELECT * FROM public.review_onboarding_application_atomic(
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'approve',
  'Lifecycle contract approval'
);
SELECT * FROM public.review_onboarding_application_atomic(
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'approve',
  'Lifecycle contract approval'
);
SELECT * FROM public.review_onboarding_application_atomic(
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  'approve',
  'Lifecycle contract approval'
);

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  FOREACH v_user_id IN ARRAY ARRAY[
    '10000000-0000-0000-0000-000000000003'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    '10000000-0000-0000-0000-000000000005'::uuid
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.onboarding_applications a
      JOIN public.profiles p ON p.user_id = a.user_id
      JOIN public.companies c ON c.id = a.company_id
      JOIN public.company_memberships cm ON cm.company_id = c.id AND cm.user_id = a.user_id
      WHERE a.user_id = v_user_id
        AND a.status = 'approved'
        AND p.status = 'active'
        AND c.status::text = 'active'
        AND cm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Approval did not activate all access records for user %.', v_user_id;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.user_id = '10000000-0000-0000-0000-000000000005'
      AND d.app_access = true
  ) THEN
    RAISE EXCEPTION 'Owner Driver app access was not activated by approval.';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.onboarding_applications
    SET status = 'draft'
    WHERE id = '20000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'Approved onboarding was reopened by an invalid status transition.';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;
END;
$$;

ROLLBACK;
