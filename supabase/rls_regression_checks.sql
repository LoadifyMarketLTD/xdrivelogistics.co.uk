-- Repeatable RLS regression verification checks.
-- Run manually in SQL editor to verify policy drift for operational tables.

-- 1) Ensure no broad FOR ALL policies remain on hardened operational tables.
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'jobs',
    'job_documents',
    'job_notes',
    'job_tracking_events',
    'quotes',
    'invoices'
  )
  AND cmd = 'ALL'
ORDER BY tablename, policyname;

-- 2) Full policy matrix for hardened tables.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'jobs',
    'job_documents',
    'job_notes',
    'job_tracking_events',
    'quotes',
    'invoices'
  )
ORDER BY tablename, policyname;

-- 3) Expected policy count: 24 (6 tables x 4 commands).
SELECT COUNT(*) AS hardened_policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'jobs',
    'job_documents',
    'job_notes',
    'job_tracking_events',
    'quotes',
    'invoices'
  )
  AND policyname LIKE ANY (ARRAY[
    '%_select_non_driver',
    '%_insert_non_driver',
    '%_update_creator_or_admin',
    '%_delete_creator_or_admin'
  ]);

-- 4) Spot-check helper functions exist.
SELECT n.nspname AS schema_name, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_company_non_driver', 'is_company_admin', 'can_non_driver_access_job', 'can_admin_manage_job')
ORDER BY p.proname;
