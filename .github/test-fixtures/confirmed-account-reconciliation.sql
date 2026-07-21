CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  raw_user_meta_data jsonb,
  raw_app_meta_data jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  role text,
  status text,
  is_driver boolean NOT NULL DEFAULT false,
  company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_applications (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  account_type text,
  workspace_mode text,
  owner_driver_workspace boolean,
  status text,
  current_step text,
  completion_percentage integer,
  last_activity_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  company_id uuid,
  role_in_company text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  app_access boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO auth.users (email, raw_user_meta_data, raw_app_meta_data)
SELECT email, '{}'::jsonb, '{}'::jsonb
FROM (VALUES
  ('thesbsourier@yahoo.com'),
  ('ajhcouriersltd@outlook.com'),
  ('arif52@hotmail.co.uk'),
  ('earlyriselogistics.erl@gmail.com'),
  ('maria.amariutei15@gmail.com'),
  ('usamaali5454@gmail.com'),
  ('kennykagande2@gmail.com'),
  ('arvinraj1515@gmail.com'),
  ('danielapostoae@yahoo.com'),
  ('mtlogisticsgroup555@gmail.com'),
  ('ryolimitedlogistics@outlook.com'),
  ('info@hszlogistics.co.uk'),
  ('alexa.dorobantu86@gmail.com'),
  ('tomm25cowper@gmail.com'),
  ('logistics@navson.com'),
  ('dola-9491@outlook.com'),
  ('royhandley50@hotmail.co.uk'),
  ('dannyelbill@gmail.com'),
  ('dannyelbill447@gmail.com'),
  ('dannycourierltd@gmail.com'),
  ('angelicatoda@gmail.com'),
  ('fleserdumitru@gmail.com'),
  ('loadifymarket.co.uk@gmail.com'),
  ('xdrivelogisticsltd@gmail.com')
) AS fixture(email);

INSERT INTO public.profiles (user_id, role, status, is_driver)
SELECT
  id,
  CASE
    WHEN email IN ('mtlogisticsgroup555@gmail.com', 'ryolimitedlogistics@outlook.com') THEN 'admin'
    WHEN email = 'info@hszlogistics.co.uk' THEN 'company_admin'
    WHEN email = 'alexa.dorobantu86@gmail.com' THEN 'driver'
    WHEN email IN ('tomm25cowper@gmail.com', 'logistics@navson.com') THEN 'customer'
    WHEN email = 'dola-9491@outlook.com' THEN 'owner'
    WHEN email = 'royhandley50@hotmail.co.uk' THEN 'company_admin'
    WHEN email = 'xdrivelogisticsltd@gmail.com' THEN 'owner'
    ELSE 'driver'
  END,
  'active',
  email NOT IN (
    'mtlogisticsgroup555@gmail.com',
    'ryolimitedlogistics@outlook.com',
    'info@hszlogistics.co.uk',
    'tomm25cowper@gmail.com',
    'logistics@navson.com',
    'dola-9491@outlook.com',
    'royhandley50@hotmail.co.uk',
    'xdrivelogisticsltd@gmail.com'
  )
FROM auth.users;

INSERT INTO public.onboarding_applications (
  user_id, email, account_type, workspace_mode,
  owner_driver_workspace, status, current_step,
  completion_percentage, last_activity_at, payload
)
SELECT id, email, 'owner_driver', 'owner_driver', true,
       'in_progress', 'account_type_wizard', 60, now(), '{"keep":"maria-payload"}'::jsonb
FROM auth.users WHERE email = 'maria.amariutei15@gmail.com';

INSERT INTO public.onboarding_applications (
  user_id, email, account_type, workspace_mode,
  owner_driver_workspace, status, current_step,
  completion_percentage, last_activity_at, payload
)
SELECT id, email, 'owner_driver', 'owner_driver', true,
       'approved', 'identity_documents', 40, now(), '{"keep":"arvin-payload"}'::jsonb
FROM auth.users WHERE email = 'arvinraj1515@gmail.com';

INSERT INTO public.onboarding_applications (
  user_id, email, account_type, workspace_mode,
  owner_driver_workspace, status, current_step,
  completion_percentage, last_activity_at, payload
)
SELECT id, email, 'customer_shipper', 'customer', false,
       'in_progress', 'workspace_ready', 100, now(), '{"keep":"tom-payload"}'::jsonb
FROM auth.users WHERE email = 'tomm25cowper@gmail.com';

INSERT INTO public.onboarding_applications (
  user_id, email, account_type, workspace_mode,
  owner_driver_workspace, status, current_step,
  completion_percentage, last_activity_at, payload
)
SELECT id, email, 'owner_driver', 'owner_driver', true,
       'draft', 'account_type_wizard', 5, now(), '{"keep":"alexa-payload"}'::jsonb
FROM auth.users WHERE email = 'alexa.dorobantu86@gmail.com';

INSERT INTO public.drivers (user_id, app_access)
SELECT id, true
FROM auth.users
WHERE email IN ('arvinraj1515@gmail.com', 'alexa.dorobantu86@gmail.com');
