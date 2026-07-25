-- Preflight check for 20260721221000_reconcile_confirmed_current_accounts.sql
--
-- Run this BEFORE applying migration 20260721221000.
--
-- GATE: Every row in group 'confirmed_15' must have exists_in_auth_users = true.
-- Any false means that address is not in auth.users — the migration's postcondition
-- check would raise an exception or silently skip that account.
--
-- Review columns:
--   profile_role_now           → will be overwritten by migration
--   onboarding_status_now      → may change to 'approved' (auto_approve rows)
--   driver_app_access_now      → will be updated based on approval status
--
-- Safe to run read-only at any time.

WITH confirmed (
  email, metadata_role, requested_role, profile_role,
  is_driver, account_type, workspace_mode, owner_driver_workspace,
  auto_approve, force_incomplete
) AS (
  VALUES
    ('thesbsourier@yahoo.com',           'driver',        'owner_operator',   'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
    ('ajhcouriersltd@outlook.com',       'driver',        'owner_operator',   'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
    ('arif52@hotmail.co.uk',             'driver',        'owner_operator',   'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
    ('earlyriselogistics.erl@gmail.com', 'driver',        'owner_operator',   'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
    ('maria.amariutei15@gmail.com',      'driver',        'owner_operator',   'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
    ('usamaali5454@gmail.com',           'driver',        'owner_operator',   'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
    ('kennykagande2@gmail.com',          'driver',        'owner_operator',   'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
    ('arvinraj1515@gmail.com',           'driver',        'owner_operator',   'driver',        true,  'owner_driver',     'owner_driver', true,  false, true),
    ('danielapostoae@yahoo.com',         'driver',        'owner_operator',   'driver',        true,  'owner_driver',     'owner_driver', true,  false, false),
    ('mtlogisticsgroup555@gmail.com',    'company_admin', 'fleet_operator',   'company_admin', false, 'fleet_courier',    'company',      false, false, false),
    ('ryolimitedlogistics@outlook.com',  'company_admin', 'fleet_operator',   'company_admin', false, 'fleet_courier',    'company',      false, false, false),
    ('info@hszlogistics.co.uk',          'company_admin', 'fleet_operator',   'company_admin', false, 'fleet_courier',    'company',      false, false, false),
    ('alexa.dorobantu86@gmail.com',      'company_admin', 'fleet_operator',   'company_admin', false, 'fleet_courier',    'company',      false, false, false),
    ('tomm25cowper@gmail.com',           'customer',      'customer_shipper', 'customer',      false, 'customer_shipper', 'customer',     false, true,  false),
    ('logistics@navson.com',             'customer',      'customer_shipper', 'customer',      false, 'customer_shipper', 'customer',     false, true,  false)
),
internal_accounts (email) AS (
  VALUES
    ('dannyelbill@gmail.com'),
    ('dannyelbill447@gmail.com'),
    ('dannycourierltd@gmail.com'),
    ('angelicatoda@gmail.com'),
    ('fleserdumitru@gmail.com'),
    ('loadifymarket.co.uk@gmail.com'),
    ('xdrivelogisticsltd@gmail.com')
)
SELECT
  'confirmed_15' AS group_name,
  c.email,
  u.id                           AS user_id,
  (u.id IS NOT NULL)             AS exists_in_auth_users,
  p.role::text                   AS profile_role_now,
  p.is_driver                    AS profile_is_driver_now,
  p.is_internal_account          AS profile_is_internal_now,
  oa.account_type::text          AS onboarding_account_type_now,
  oa.workspace_mode::text        AS onboarding_workspace_mode_now,
  oa.owner_driver_workspace      AS onboarding_owner_driver_workspace_now,
  oa.status::text                AS onboarding_status_now,
  d.app_access                   AS driver_app_access_now
FROM confirmed c
LEFT JOIN auth.users u              ON lower(u.email) = c.email
LEFT JOIN public.profiles p         ON p.user_id = u.id
LEFT JOIN public.onboarding_applications oa ON oa.user_id = u.id
LEFT JOIN public.drivers d          ON d.user_id = u.id

UNION ALL

SELECT
  'internal_7'   AS group_name,
  i.email,
  u.id,
  (u.id IS NOT NULL),
  p.role::text,
  p.is_driver,
  p.is_internal_account,
  oa.account_type::text,
  oa.workspace_mode::text,
  oa.owner_driver_workspace,
  oa.status::text,
  d.app_access
FROM internal_accounts i
LEFT JOIN auth.users u              ON lower(u.email) = i.email
LEFT JOIN public.profiles p         ON p.user_id = u.id
LEFT JOIN public.onboarding_applications oa ON oa.user_id = u.id
LEFT JOIN public.drivers d          ON d.user_id = u.id

ORDER BY group_name, email;
