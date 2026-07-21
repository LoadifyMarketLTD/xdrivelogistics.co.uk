DO $$
DECLARE
  internal_count integer;
BEGIN
  SELECT count(*) INTO internal_count
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(u.email) IN (
    'dannyelbill@gmail.com',
    'dannyelbill447@gmail.com',
    'dannycourierltd@gmail.com',
    'angelicatoda@gmail.com',
    'fleserdumitru@gmail.com',
    'loadifymarket.co.uk@gmail.com',
    'xdrivelogisticsltd@gmail.com'
  )
    AND p.is_internal_account;
  IF internal_count <> 7 THEN
    RAISE EXCEPTION 'Expected 7 internal accounts, found %', internal_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    JOIN public.onboarding_applications oa ON oa.user_id = u.id
    WHERE u.email = 'logistics@navson.com'
      AND p.role = 'customer'
      AND NOT p.is_driver
      AND oa.account_type = 'customer_shipper'
      AND oa.status = 'approved'
      AND oa.completion_percentage = 100
  ) THEN
    RAISE EXCEPTION 'Navson was not preserved as an approved customer.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    JOIN public.onboarding_applications oa ON oa.user_id = u.id
    WHERE u.email = 'alexa.dorobantu86@gmail.com'
      AND p.role = 'company_admin'
      AND NOT p.is_driver
      AND oa.account_type = 'fleet_courier'
      AND oa.status <> 'approved'
      AND oa.payload->>'keep' = 'alexa-payload'
  ) THEN
    RAISE EXCEPTION 'Alexa was not safely moved to Fleet onboarding.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.onboarding_applications oa ON oa.user_id = u.id
    JOIN public.drivers d ON d.user_id = u.id
    WHERE u.email = 'arvinraj1515@gmail.com'
      AND oa.status = 'in_progress'
      AND oa.completion_percentage = 40
      AND NOT d.app_access
      AND oa.payload->>'keep' = 'arvin-payload'
  ) THEN
    RAISE EXCEPTION 'Arvin incomplete approval was not restricted safely.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.onboarding_applications oa ON oa.user_id = u.id
    WHERE u.email = 'tomm25cowper@gmail.com'
      AND oa.status = 'approved'
      AND oa.completion_percentage = 100
      AND oa.payload->>'keep' = 'tom-payload'
  ) THEN
    RAISE EXCEPTION 'Tom customer completion was not reconciled.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    WHERE u.email = 'dola-9491@outlook.com'
      AND p.role = 'owner'
      AND NOT p.is_internal_account
  ) OR NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    WHERE u.email = 'royhandley50@hotmail.co.uk'
      AND p.role = 'company_admin'
      AND NOT p.is_internal_account
  ) THEN
    RAISE EXCEPTION 'Excluded Dola or Roy account was modified.';
  END IF;

  IF (SELECT count(*) FROM public.account_reconciliation_confirmed_20260721_snapshot) <> 22 THEN
    RAISE EXCEPTION 'Snapshot did not capture all intended existing identities.';
  END IF;
END;
$$;
