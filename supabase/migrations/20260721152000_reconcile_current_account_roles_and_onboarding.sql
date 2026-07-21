-- Reconcile the current XDrive accounts without deleting identities, companies,
-- memberships, jobs or documents. The migration is idempotent and captures a
-- private pre-change snapshot for rollback/audit purposes.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_internal_account boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_external_accounts_idx
  ON public.profiles (created_at DESC)
  WHERE is_internal_account = false;

CREATE TABLE IF NOT EXISTS public.account_reconciliation_20260721_snapshot (
  id bigserial PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  auth_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_row jsonb,
  onboarding_row jsonb,
  membership_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id)
);

ALTER TABLE public.account_reconciliation_20260721_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_reconciliation_20260721_snapshot FROM anon, authenticated;

CREATE TEMP TABLE account_reconciliation_plan (
  email text PRIMARY KEY,
  metadata_role text NOT NULL,
  profile_role text NOT NULL,
  is_driver boolean NOT NULL,
  account_type text NOT NULL,
  workspace_mode text NOT NULL,
  owner_driver_workspace boolean NOT NULL,
  force_approved boolean NOT NULL DEFAULT false
) ON COMMIT DROP;

INSERT INTO account_reconciliation_plan (
  email,
  metadata_role,
  profile_role,
  is_driver,
  account_type,
  workspace_mode,
  owner_driver_workspace,
  force_approved
)
VALUES
  ('thesbsourier@yahoo.com',              'driver',        'driver',   true,  'owner_driver',    'owner_driver', true,  false),
  ('ajhcouriersltd@outlook.com',          'driver',        'driver',   true,  'owner_driver',    'owner_driver', true,  false),
  ('arif52@hotmail.co.uk',                'driver',        'driver',   true,  'owner_driver',    'owner_driver', true,  false),
  ('earlyriselogistics.erl@gmail.com',    'driver',        'driver',   true,  'owner_driver',    'owner_driver', true,  false),
  ('maria.amariutei15@gmail.com',         'driver',        'driver',   true,  'owner_driver',    'owner_driver', true,  false),
  ('usamaali5454@gmail.com',              'driver',        'driver',   true,  'owner_driver',    'owner_driver', true,  false),
  ('kennykagande2@gmail.com',             'driver',        'driver',   true,  'owner_driver',    'owner_driver', true,  false),
  ('arvinraj1515@gmail.com',              'driver',        'driver',   true,  'owner_driver',    'owner_driver', true,  false),
  ('danielapostoae@yahoo.com',            'driver',        'driver',   true,  'owner_driver',    'owner_driver', true,  false),
  ('mtlogisticsgroup555@gmail.com',       'company_admin', 'admin',    false, 'fleet_courier',   'company',      false, false),
  ('dola-9491@outlook.com',               'company_admin', 'admin',    false, 'fleet_courier',   'company',      false, false),
  ('ryolimitedlogistics@outlook.com',     'company_admin', 'admin',    false, 'fleet_courier',   'company',      false, false),
  ('info@hszlogistics.co.uk',             'company_admin', 'admin',    false, 'fleet_courier',   'company',      false, false),
  ('royhandley50@hotmail.co.uk',          'company_admin', 'admin',    false, 'fleet_courier',   'company',      false, false),
  ('alexa.dorobantu86@gmail.com',         'company_admin', 'admin',    false, 'fleet_courier',   'company',      false, false),
  ('tomm25cowper@gmail.com',              'customer',      'customer', false, 'customer_shipper','customer',     false, true),
  ('logistics@navson.com',                'customer',      'customer', false, 'customer_shipper','customer',     false, true);

-- Capture every named internal/external account once before changing it.
INSERT INTO public.account_reconciliation_20260721_snapshot (
  user_id,
  email,
  auth_metadata,
  profile_row,
  onboarding_row,
  membership_rows
)
SELECT
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data, '{}'::jsonb),
  to_jsonb(p),
  to_jsonb(oa),
  coalesce(
    (
      SELECT jsonb_agg(to_jsonb(cm) ORDER BY cm.created_at, cm.id)
      FROM public.company_memberships cm
      WHERE cm.user_id = u.id
    ),
    '[]'::jsonb
  )
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.onboarding_applications oa ON oa.user_id = u.id
WHERE lower(u.email) IN (
  SELECT email FROM account_reconciliation_plan
  UNION ALL SELECT 'dannyelbill@gmail.com'
  UNION ALL SELECT 'dannyelbill447@gmail.com'
  UNION ALL SELECT 'dannycourierltd@gmail.com'
  UNION ALL SELECT 'angelicatoda@gmail.com'
  UNION ALL SELECT 'fleserdumitru@gmail.com'
  UNION ALL SELECT 'loadifymarket.co.uk@gmail.com'
  UNION ALL SELECT 'xdrivelogisticsltd@gmail.com'
)
ON CONFLICT (user_id) DO NOTHING;

-- Mark the owner's personal, test and legacy accounts so operational totals can
-- exclude them without deleting or weakening any existing access.
UPDATE public.profiles p
SET is_internal_account = true,
    updated_at = now()
FROM auth.users u
WHERE u.id = p.user_id
  AND lower(u.email) IN (
    'dannyelbill@gmail.com',
    'dannyelbill447@gmail.com',
    'dannycourierltd@gmail.com',
    'angelicatoda@gmail.com',
    'fleserdumitru@gmail.com',
    'loadifymarket.co.uk@gmail.com',
    'xdrivelogisticsltd@gmail.com'
  );

-- Make the authoritative signup metadata agree with the intended workspace.
UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'role', plan.metadata_role,
      'requested_role', CASE plan.account_type
        WHEN 'owner_driver' THEN 'owner_operator'
        WHEN 'fleet_courier' THEN 'fleet_operator'
        WHEN 'broker_shipper' THEN 'transport_broker'
        ELSE 'customer_shipper'
      END,
      'signup_type', CASE plan.account_type
        WHEN 'owner_driver' THEN 'owner_operator'
        WHEN 'fleet_courier' THEN 'fleet_operator'
        WHEN 'broker_shipper' THEN 'transport_broker'
        ELSE 'customer_shipper'
      END,
      'account_type', plan.account_type,
      'workspace_mode', plan.workspace_mode,
      'owner_driver_workspace', plan.owner_driver_workspace
    ),
    updated_at = now()
FROM account_reconciliation_plan plan
WHERE lower(u.email) = plan.email;

-- Ensure every mapped identity has one canonical profile row. `admin` is the
-- legacy-compatible stored value that resolves to company_admin in the app.
INSERT INTO public.profiles (
  user_id,
  role,
  status,
  is_driver,
  is_internal_account,
  created_at,
  updated_at
)
SELECT
  u.id,
  plan.profile_role,
  'active',
  plan.is_driver,
  false,
  now(),
  now()
FROM account_reconciliation_plan plan
JOIN auth.users u ON lower(u.email) = plan.email
ON CONFLICT (user_id)
DO UPDATE SET
  role = EXCLUDED.role,
  status = CASE
    WHEN EXCLUDED.role = 'customer' THEN 'active'
    ELSE coalesce(public.profiles.status, 'active')
  END,
  is_driver = EXCLUDED.is_driver,
  is_internal_account = false,
  updated_at = now();

-- Create missing onboarding rows and reconcile existing rows without removing
-- user-entered payloads, tokens, review notes or company links.
INSERT INTO public.onboarding_applications (
  user_id,
  email,
  account_type,
  workspace_mode,
  owner_driver_workspace,
  status,
  current_step,
  completion_percentage,
  last_activity_at,
  payload,
  created_at,
  updated_at
)
SELECT
  u.id,
  plan.email,
  plan.account_type,
  plan.workspace_mode,
  plan.owner_driver_workspace,
  CASE WHEN plan.force_approved THEN 'approved' ELSE 'draft' END,
  CASE WHEN plan.force_approved THEN 'workspace_unlocked' ELSE 'account_type_wizard' END,
  CASE WHEN plan.force_approved THEN 100 ELSE 5 END,
  now(),
  jsonb_build_object(
    'account_reconciled_at', now(),
    'account_reconciliation_source', '20260721152000'
  ),
  now(),
  now()
FROM account_reconciliation_plan plan
JOIN auth.users u ON lower(u.email) = plan.email
ON CONFLICT (user_id)
DO UPDATE SET
  email = EXCLUDED.email,
  account_type = EXCLUDED.account_type,
  workspace_mode = EXCLUDED.workspace_mode,
  owner_driver_workspace = EXCLUDED.owner_driver_workspace,
  status = CASE
    WHEN EXCLUDED.status = 'approved' THEN 'approved'
    WHEN public.onboarding_applications.status = 'approved' THEN 'approved'
    WHEN public.onboarding_applications.status IN ('draft', 'in_progress', 'under_review', 'rejected', 'request_changes')
      THEN public.onboarding_applications.status
    ELSE 'draft'
  END,
  current_step = CASE
    WHEN EXCLUDED.status = 'approved' OR public.onboarding_applications.status = 'approved'
      THEN 'workspace_unlocked'
    WHEN coalesce(public.onboarding_applications.completion_percentage, 0) >= 40
         AND EXCLUDED.account_type = 'owner_driver'
      THEN 'identity_documents'
    WHEN coalesce(public.onboarding_applications.completion_percentage, 0) >= 40
         AND EXCLUDED.account_type = 'fleet_courier'
      THEN 'company_documents'
    ELSE coalesce(nullif(public.onboarding_applications.current_step, ''), 'account_type_wizard')
  END,
  completion_percentage = CASE
    WHEN EXCLUDED.status = 'approved' OR public.onboarding_applications.status = 'approved' THEN 100
    ELSE greatest(coalesce(public.onboarding_applications.completion_percentage, 0), 5)
  END,
  last_activity_at = greatest(public.onboarding_applications.last_activity_at, now()),
  payload = coalesce(public.onboarding_applications.payload, '{}'::jsonb) || EXCLUDED.payload,
  updated_at = now();

-- A fleet/customer profile must never retain driver-app access merely because
-- it was previously misclassified. Owner-driver access remains approval-gated.
UPDATE public.drivers d
SET app_access = CASE WHEN oa.status = 'approved' THEN true ELSE false END,
    is_active = true,
    updated_at = now()
FROM auth.users u
JOIN account_reconciliation_plan plan ON plan.email = lower(u.email)
JOIN public.onboarding_applications oa ON oa.user_id = u.id
WHERE d.user_id = u.id
  AND plan.account_type = 'owner_driver';

UPDATE public.drivers d
SET app_access = false,
    is_active = false,
    updated_at = now()
FROM auth.users u
JOIN account_reconciliation_plan plan ON plan.email = lower(u.email)
WHERE d.user_id = u.id
  AND plan.account_type <> 'owner_driver';

-- Fail the whole transaction if the intended postconditions were not reached.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    WHERE lower(u.email) IN (
      'dannyelbill@gmail.com',
      'dannyelbill447@gmail.com',
      'dannycourierltd@gmail.com',
      'angelicatoda@gmail.com',
      'fleserdumitru@gmail.com',
      'loadifymarket.co.uk@gmail.com',
      'xdrivelogisticsltd@gmail.com'
    )
      AND p.is_internal_account IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'Internal-account classification failed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM account_reconciliation_plan plan
    JOIN auth.users u ON lower(u.email) = plan.email
    LEFT JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.onboarding_applications oa ON oa.user_id = u.id
    WHERE p.user_id IS NULL
       OR oa.user_id IS NULL
       OR p.role IS DISTINCT FROM plan.profile_role
       OR p.is_driver IS DISTINCT FROM plan.is_driver
       OR oa.account_type IS DISTINCT FROM plan.account_type
       OR oa.workspace_mode IS DISTINCT FROM plan.workspace_mode
       OR oa.owner_driver_workspace IS DISTINCT FROM plan.owner_driver_workspace
  ) THEN
    RAISE EXCEPTION 'External account reconciliation postcondition failed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    JOIN public.onboarding_applications oa ON oa.user_id = u.id
    WHERE lower(u.email) = 'logistics@navson.com'
      AND (p.role <> 'customer' OR oa.account_type <> 'customer_shipper' OR oa.status <> 'approved')
  ) THEN
    RAISE EXCEPTION 'Navson customer reconciliation failed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    JOIN public.onboarding_applications oa ON oa.user_id = u.id
    WHERE lower(u.email) = 'alexa.dorobantu86@gmail.com'
      AND (p.role <> 'admin' OR p.is_driver OR oa.account_type <> 'fleet_courier')
  ) THEN
    RAISE EXCEPTION 'Alexa fleet reconciliation failed.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
