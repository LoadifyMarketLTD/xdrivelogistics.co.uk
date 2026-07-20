-- XDrive Logistics: read-only live audit for owner-driver onboarding and email delivery
-- Safe to run in Supabase SQL Editor. This file performs SELECT-only inspection.

-- 1. Onboarding TTL and potentially sensitive app settings (values masked where needed)
SELECT
  key,
  CASE
    WHEN key ILIKE '%key%' OR key ILIKE '%secret%' OR key ILIKE '%password%'
      THEN '[CONFIGURED]'
    ELSE value
  END AS safe_value
FROM public.app_settings
WHERE key IN (
  'onboarding_token_ttl_hours',
  'supabase_project_ref',
  'supabase_service_role_key'
)
ORDER BY key;

-- 2. Notification and onboarding triggers
SELECT
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('notification_events', 'onboarding_applications')
ORDER BY event_object_table, trigger_name;

-- 3. Relevant functions
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'supabase_functions')
  AND (
    p.proname ILIKE '%onboarding%'
    OR p.proname ILIKE '%notification%'
    OR p.proname ILIKE '%compliance%'
  )
ORDER BY schema_name, function_name;

-- 4. Onboarding status distribution
SELECT
  account_type,
  status,
  COUNT(*) AS total
FROM public.onboarding_applications
GROUP BY account_type, status
ORDER BY account_type, status;

-- 5. Notification status distribution
SELECT
  event_type,
  status,
  COUNT(*) AS total
FROM public.notification_events
GROUP BY event_type, status
ORDER BY event_type, status;

-- 6. Failed or stuck onboarding emails, without personal payloads
SELECT
  id,
  event_type,
  status,
  created_at,
  updated_at
FROM public.notification_events
WHERE event_type = 'onboarding_invite'
  AND (
    status = 'failed'
    OR (status = 'pending' AND created_at < now() - interval '15 minutes')
  )
ORDER BY created_at DESC
LIMIT 100;

-- 7. Owner-driver account linkage and status overview
SELECT
  oa.id AS onboarding_application_id,
  oa.user_id,
  oa.account_type,
  oa.status AS onboarding_status,
  oa.company_id,
  p.role AS profile_role,
  p.status AS profile_status,
  p.is_driver,
  p.company_id AS profile_company_id,
  c.status AS company_status,
  c.company_type,
  c.created_by,
  cm.role_in_company,
  cm.status AS membership_status,
  d.id AS driver_id,
  d.status AS driver_status,
  d.app_access,
  d.company_id AS driver_company_id
FROM public.onboarding_applications oa
LEFT JOIN public.profiles p ON p.user_id = oa.user_id
LEFT JOIN public.companies c ON c.id = oa.company_id
LEFT JOIN public.company_memberships cm
  ON cm.company_id = oa.company_id
 AND cm.user_id = oa.user_id
LEFT JOIN public.drivers d ON d.user_id = oa.user_id
WHERE oa.account_type = 'owner_driver'
ORDER BY oa.created_at DESC
LIMIT 100;

-- 8. RLS enabled state on critical tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'companies',
    'company_memberships',
    'drivers',
    'vehicles',
    'onboarding_applications',
    'notification_events',
    'app_settings',
    'jobs',
    'job_bids'
  )
ORDER BY tablename;

-- 9. Policies on critical tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'companies',
    'company_memberships',
    'drivers',
    'vehicles',
    'onboarding_applications',
    'notification_events',
    'app_settings',
    'jobs',
    'job_bids'
  )
ORDER BY tablename, policyname;

-- 10. Canonical onboarding submit function definition
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'submit_onboarding_application';

-- 11. Compliance function definition
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'company_compliance_issues';
