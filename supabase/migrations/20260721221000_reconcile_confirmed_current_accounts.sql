-- Reconcile only the current accounts whose intended XDrive role is confirmed.
-- No identity, company, membership, job, document or onboarding payload is deleted.
-- Dola and Roy are deliberately excluded because their intended account type is
-- not confirmed. The duplicate HSZ membership is also left untouched pending
-- company-level inspection.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_internal_account boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_external_accounts_idx
  ON public.profiles (created_at DESC)
  WHERE is_internal_account = false;

CREATE TABLE IF NOT EXISTS public.account_reconciliation_20260721_snapshot (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_row jsonb,
  onboarding_row jsonb,
  membership_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  driver_rows jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.account_reconciliation_20260721_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_reconciliation_20260721_snapshot FROM anon, authenticated;

CREATE TEMP TABLE confirmed_account_plan (
  email text PRIMARY KEY,
  metadata_role text NOT NULL,
  requested_role text NOT NULL,
  profile_role text NOT NULL,
  is_driver boolean NOT NULL,
  account_type text NOT NULL,
  workspace_mode text NOT NULL,
  owner_driver_workspace boolean NOT NULL,
  auto_approve boolean NOT NULL DEFAULT false,
  force_incomplete boolean NOT NULL DEFAULT false
) ON COMMIT DROP;

INSERT INTO confirmed_account_plan (
  email,
  metadata_role,
  requested_role,
  profile_role,
  is_driver,
  account_type,
  workspace_mode,
  owner_driver_workspace,
  auto_approve,
  force_incomplete
)
VALUES
  ('thesbsourier@yahoo.com',           'driver',        'owner_operator',  'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
  ('ajhcouriersltd@outlook.com',       'driver',        'owner_operator',  'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
  ('arif52@hotmail.co.uk',             'driver',        'owner_operator',  'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
  ('earlyriselogistics.erl@gmail.com', 'driver',        'owner_operator',  'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
  ('maria.amariutei15@gmail.com',      'driver',        'owner_operator',  'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
  ('usamaali5454@gmail.com',           'driver',        'owner_operator',  'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
  ('kennykagande2@gmail.com',          'driver',        'owner_operator',  'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
  ('arvinraj1515@gmail.com',           'driver',        'owner_operator',  'driver',        true,  'owner_driver',     'owner_driver', true,  false, true),
  ('danielapostoae@yahoo.com',         'driver',        'owner_operator',  'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
  ('mtlogisticsgroup555@gmail.com',    'company_admin', 'fleet_operator',  'company_admin', false, 'fleet_courier',    'company',      false, false, false),
  ('ryolimitedlogistics@outlook.com',  'company_admin', 'fleet_operator',  'company_admin', false, 'fleet_courier',    'company',      false, false, false),
  ('info@hszlogistics.co.uk',          'company_admin', 'fleet_operator',  'company_admin', false, 'fleet_courier',    'company',      false, false, false),
  ('alexa.dorobantu86@gmail.com',      'company_admin', 'fleet_operator',  'company_admin', false, 'fleet_courier',    'company',      false, false, false),
  ('tomm25cowper@gmail.com',           'customer',      'customer_shipper','customer',      false, 'customer_shipper', 'customer',     false, true,  false),
  ('logistics@navson.com',             'customer',      'customer_shipper','customer',      false, 'customer_shipper', 'customer',     false, true,  false);

-- Snapshot every account touched by this migration, including the seven
-- owner-controlled internal/test/legacy accounts.
INSERT INTO public.account_reconciliation_20260721_snapshot (
  user_id,
  email,
  raw_user_meta_data,
  raw_app_meta_data,
  profile_row,
  onboarding_row,
  membership_rows,
  driver_rows
)
SELECT
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data, '{}'::jsonb),
  coalesce(u.raw_app_meta_data, '{}'::jsonb),
  to_jsonb(p),
  to_jsonb(oa),
  coalesce((
    SELECT jsonb_agg(to_jsonb(cm) ORDER BY cm.created_at, cm.id)
    FROM public.company_memberships cm
    WHERE cm.user_id = u.id
  ), '[]'::jsonb),
  coalesce((
    SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at, d.id)
    FROM public.drivers d
    WHERE d.user_id = u.id
  ), '[]'::jsonb)
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.onboarding_applications oa ON oa.user_id = u.id
WHERE lower(u.email) IN (
  SELECT email FROM confirmed_account_plan
  UNION ALL SELECT 'dannyelbill@gmail.com'
  UNION ALL SELECT 'dannyelbill447@gmail.com'
  UNION ALL SELECT 'dannycourierltd@gmail.com'
  UNION ALL SELECT 'angelicatoda@gmail.com'
  UNION ALL SELECT 'fleserdumitru@gmail.com'
  UNION ALL SELECT 'loadifymarket.co.uk@gmail.com'
  UNION ALL SELECT 'xdrivelogisticsltd@gmail.com'
)
ON CONFLICT (user_id) DO NOTHING;

-- Internal/test/legacy identities are excluded from external-user statistics,
-- but their permissions and memberships are otherwise left unchanged.
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

-- Repair only the signup/workspace metadata used to initialise or resume the
-- correct onboarding journey. Passwords and authentication settings are not
-- touched.
UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'role', plan.metadata_role,
      'requested_role', plan.requested_role,
      'signup_type', plan.requested_role,
      'account_type', plan.account_type,
      'workspace_mode', plan.workspace_mode,
      'owner_driver_workspace', plan.owner_driver_workspace
    ),
    updated_at = now()
FROM confirmed_account_plan plan
WHERE lower(u.email) = plan.email;

-- Ensure a canonical profile exists for each confirmed external identity.
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
FROM confirmed_account_plan plan
JOIN auth.users u ON lower(u.email) = plan.email
ON CONFLICT (user_id)
DO UPDATE SET
  role = EXCLUDED.role,
  status = 'active',
  is_driver = EXCLUDED.is_driver,
  is_internal_account = false,
  updated_at = now();

-- Create missing onboarding records and correct the account/workspace identity
-- of existing records without replacing payloads, documents, review notes,
-- tokens or linked companies.
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
  CASE WHEN plan.auto_approve THEN 'approved' ELSE 'draft' END,
  CASE WHEN plan.auto_approve THEN 'workspace_ready' ELSE 'account_type_wizard' END,
  CASE WHEN plan.auto_approve THEN 100 ELSE 5 END,
  now(),
  jsonb_build_object(
    'account_reconciled_at', now(),
    'account_reconciliation_source', '20260721221000'
  ),
  now(),
  now()
FROM confirmed_account_plan plan
JOIN auth.users u ON lower(u.email) = plan.email
ON CONFLICT (user_id)
DO UPDATE SET
  email = EXCLUDED.email,
  account_type = EXCLUDED.account_type,
  workspace_mode = EXCLUDED.workspace_mode,
  owner_driver_workspace = EXCLUDED.owner_driver_workspace,
  status = CASE
    WHEN plan.auto_approve THEN 'approved'
    WHEN plan.force_incomplete THEN 'in_progress'
    WHEN public.onboarding_applications.status IN (
      'draft', 'in_progress', 'submitted', 'under_review', 'request_changes', 'rejected', 'approved'
    ) THEN public.onboarding_applications.status
    ELSE 'draft'
  END,
  current_step = CASE
    WHEN plan.auto_approve THEN 'workspace_ready'
    WHEN plan.force_incomplete THEN 'identity_documents'
    WHEN nullif(public.onboarding_applications.current_step, '') IS NOT NULL
      THEN public.onboarding_applications.current_step
    ELSE 'account_type_wizard'
  END,
  completion_percentage = CASE
    WHEN plan.auto_approve THEN 100
    WHEN plan.force_incomplete THEN least(greatest(coalesce(public.onboarding_applications.completion_percentage, 40), 40), 99)
    ELSE greatest(coalesce(public.onboarding_applications.completion_percentage, 0), 5)
  END,
  last_activity_at = now(),
  payload = coalesce(public.onboarding_applications.payload, '{}'::jsonb) || jsonb_build_object(
    'account_reconciled_at', now(),
    'account_reconciliation_source', '20260721221000'
  ),
  updated_at = now();

-- Driver-app access is granted only to a fully completed, approved owner-driver.
-- Misclassified fleet/customer accounts cannot retain driver-app access.
UPDATE public.drivers d
SET app_access = (
      plan.account_type = 'owner_driver'
      AND oa.status = 'approved'
      AND oa.completion_percentage = 100
    ),
    updated_at = now()
FROM auth.users u
JOIN confirmed_account_plan plan ON plan.email = lower(u.email)
JOIN public.onboarding_applications oa ON oa.user_id = u.id
WHERE d.user_id = u.id;

-- Fail the complete transaction if a confirmed identity was not found or the
-- intended postconditions were not reached.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM confirmed_account_plan plan
    LEFT JOIN auth.users u ON lower(u.email) = plan.email
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A confirmed account identity is missing from auth.users.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM confirmed_account_plan plan
    JOIN auth.users u ON lower(u.email) = plan.email
    LEFT JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.onboarding_applications oa ON oa.user_id = u.id
    WHERE p.user_id IS NULL
       OR oa.user_id IS NULL
       OR p.role IS DISTINCT FROM plan.profile_role
       OR p.is_driver IS DISTINCT FROM plan.is_driver
       OR p.is_internal_account IS DISTINCT FROM false
       OR oa.account_type IS DISTINCT FROM plan.account_type
       OR oa.workspace_mode IS DISTINCT FROM plan.workspace_mode
       OR oa.owner_driver_workspace IS DISTINCT FROM plan.owner_driver_workspace
  ) THEN
    RAISE EXCEPTION 'Confirmed account reconciliation postcondition failed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    JOIN public.onboarding_applications oa ON oa.user_id = u.id
    WHERE lower(u.email) = 'logistics@navson.com'
      AND (
        p.role <> 'customer'
        OR p.is_driver
        OR oa.account_type <> 'customer_shipper'
        OR oa.status <> 'approved'
        OR oa.completion_percentage <> 100
      )
  ) THEN
    RAISE EXCEPTION 'Navson customer reconciliation failed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    JOIN public.onboarding_applications oa ON oa.user_id = u.id
    WHERE lower(u.email) = 'alexa.dorobantu86@gmail.com'
      AND (
        p.role <> 'company_admin'
        OR p.is_driver
        OR oa.account_type <> 'fleet_courier'
        OR oa.status = 'approved'
      )
  ) THEN
    RAISE EXCEPTION 'Alexa fleet reconciliation failed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.onboarding_applications oa ON oa.user_id = u.id
    LEFT JOIN public.drivers d ON d.user_id = u.id
    WHERE lower(u.email) = 'arvinraj1515@gmail.com'
      AND (
        oa.status <> 'in_progress'
        OR oa.completion_percentage >= 100
        OR coalesce(d.app_access, false)
      )
  ) THEN
    RAISE EXCEPTION 'Incomplete Arvin owner-driver approval was not safely restricted.';
  END IF;

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
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
