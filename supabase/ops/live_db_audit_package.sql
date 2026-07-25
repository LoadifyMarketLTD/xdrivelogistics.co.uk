-- ============================================================
-- XDrive Platform — Read-Only Live Database Audit Package
-- ============================================================
-- File:    supabase/ops/live_db_audit_package.sql
-- Purpose: Complete read-only inventory of the live Supabase schema.
--          Produces NO writes, modifications or schema changes.
-- Usage:   Run each statement individually in Supabase SQL Editor.
--          Read: Success + result rows = schema is consistent.
-- Warning: DO NOT run supabase migration repair or change migration history.
-- ============================================================

-- ── STEP 1: Schema overview ──────────────────────────────────────────────────
-- Purpose: List all schemas present.
-- Expected: public, auth, storage, extensions at minimum.

SELECT schema_name
FROM information_schema.schemata
ORDER BY schema_name;

-- ── STEP 2: All tables with RLS status ──────────────────────────────────────
-- Purpose: List every table, whether RLS is enabled and forced.
-- Expected: All production tables have rowsecurity = TRUE.

SELECT
  t.schemaname,
  t.tablename,
  c.relrowsecurity    AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
WHERE t.schemaname IN ('public', 'auth', 'storage')
ORDER BY t.schemaname, t.tablename;

-- ── STEP 3: All columns for key tables ──────────────────────────────────────
-- Purpose: Verify column existence for tables depended upon by application code.
-- Expected: All listed columns exist with correct data types.

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'jobs', 'job_bids', 'companies', 'profiles',
    'drivers', 'vehicles', 'invoices', 'notifications',
    'notification_events', 'company_memberships', 'broker_carrier_invitations',
    'onboarding_applications', 'support_tickets', 'job_disputes',
    'owner_audit_log', 'platform_settings', 'platform_feature_flags',
    'driver_documents', 'vehicle_documents', 'job_tracking_events',
    'invoice_payment_history', 'driver_weekly_availability', 'driver_device_tokens'
  )
ORDER BY table_name, ordinal_position;

-- ── STEP 4: All RLS policies ─────────────────────────────────────────────────
-- Purpose: List every active RLS policy with its command and roles.
-- Expected: Every public table has at least one policy.
--           No policy uses "USING (true)" without a specific role restriction.

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
ORDER BY tablename, policyname;

-- ── STEP 5: Tables with no RLS policy ───────────────────────────────────────
-- Purpose: Find public tables that have RLS enabled but no policies.
--          These are effectively locked to all non-service-role users.

SELECT
  t.tablename,
  c.relrowsecurity AS rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
WHERE t.schemaname = 'public'
  AND c.relrowsecurity = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t.tablename
  )
ORDER BY t.tablename;

-- ── STEP 6: All triggers ─────────────────────────────────────────────────────
-- Purpose: Verify all expected triggers exist and none are duplicated.
-- Expected: trg_notify_job_assigned, trg_notify_bid_accepted, trg_notify_pod_uploaded,
--           trg_bridge_notification_event_to_inbox (after migration applied).

SELECT
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ── STEP 7: All functions with security mode ─────────────────────────────────
-- Purpose: List all public functions; identify SECURITY DEFINER vs INVOKER.
-- Expected: Only trusted bridge/audit functions are SECURITY DEFINER.

SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_mode,
  pg_get_function_arguments(p.oid) AS arguments,
  l.lanname AS language
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ── STEP 8: All enums ────────────────────────────────────────────────────────
-- Purpose: List all enum types and their values.
-- Expected: Canonical job status, bid status, onboarding status enums.

SELECT
  t.typname AS enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- ── STEP 9: All indexes ──────────────────────────────────────────────────────
-- Purpose: Verify prelaunch performance indexes (migration 118) are present.

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ── STEP 10: All foreign keys ────────────────────────────────────────────────
-- Purpose: Verify referential integrity is in place for all key relationships.

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ── STEP 11: Storage buckets and policies ────────────────────────────────────
-- Purpose: Verify pod-docs, driver-docs, company-docs buckets exist with policies.

SELECT
  id,
  name,
  public,
  allowed_mime_types,
  file_size_limit,
  created_at
FROM storage.buckets
ORDER BY name;

-- Storage policies:
SELECT
  name,
  bucket_id,
  definition,
  owner_id
FROM storage.policies
ORDER BY bucket_id, name;

-- ── STEP 12: Extensions ──────────────────────────────────────────────────────
-- Purpose: Verify required extensions (uuid-ossp, pg_cron, etc.) are installed.

SELECT
  extname,
  extversion,
  extrelocatable
FROM pg_extension
ORDER BY extname;

-- ── STEP 13: Migration history ───────────────────────────────────────────────
-- Purpose: List applied Supabase migrations in order.
-- Expected: All 160+ migrations from the repository should be present.
-- DO NOT modify this table or run supabase migration repair.

SELECT
  version,
  inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY inserted_at;

-- ── STEP 14: Row counts for key tables (safe) ────────────────────────────────
-- Purpose: Verify tables have data where expected.
-- Expected: companies > 0, jobs ≥ 0, notification_events ≥ 0, notifications = 0 (pre-bridge).

SELECT 'companies'              AS table_name, COUNT(*) AS row_count FROM public.companies
UNION ALL
SELECT 'profiles',                             COUNT(*) FROM public.profiles
UNION ALL
SELECT 'jobs',                                 COUNT(*) FROM public.jobs
UNION ALL
SELECT 'job_bids',                             COUNT(*) FROM public.job_bids
UNION ALL
SELECT 'notification_events',                  COUNT(*) FROM public.notification_events
UNION ALL
SELECT 'notifications',                        COUNT(*) FROM public.notifications
UNION ALL
SELECT 'broker_carrier_invitations',           COUNT(*) FROM public.broker_carrier_invitations
UNION ALL
SELECT 'onboarding_applications',              COUNT(*) FROM public.onboarding_applications
UNION ALL
SELECT 'support_tickets',                      COUNT(*) FROM public.support_tickets
UNION ALL
SELECT 'job_disputes',                         COUNT(*) FROM public.job_disputes
UNION ALL
SELECT 'invoices',                             COUNT(*) FROM public.invoices
UNION ALL
SELECT 'driver_device_tokens',                 COUNT(*) FROM public.driver_device_tokens
UNION ALL
SELECT 'company_memberships',                  COUNT(*) FROM public.company_memberships
ORDER BY table_name;

-- ── STEP 15: Focused — notification_events model ─────────────────────────────
-- Purpose: Verify notification_events table structure, recent events, and bridge trigger.

-- 15a. Column inventory
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notification_events'
ORDER BY ordinal_position;

-- 15b. RLS policies on notification_events
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notification_events';

-- 15c. Recent events (last 20)
SELECT id, event_type, entity_type, company_id, recipient_user_id, status, created_at, processed_at
FROM public.notification_events
ORDER BY created_at DESC
LIMIT 20;

-- 15d. Event status distribution
SELECT status, COUNT(*) AS count
FROM public.notification_events
GROUP BY status;

-- 15e. Bridge trigger existence
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trg_bridge_notification_event_to_inbox';
-- Expected after migration: 1 row (AFTER INSERT on notification_events)
-- Expected before migration: 0 rows

-- ── STEP 16: Focused — notifications (legacy inbox) ──────────────────────────

-- 16a. Column inventory
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

-- 16b. RLS policies on notifications
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications';

-- 16c. Row count (should be 0 before bridge migration, >0 after new events)
SELECT COUNT(*) AS notification_row_count FROM public.notifications;

-- ── STEP 17: Focused — broker_carrier_invitations ────────────────────────────

-- 17a. Structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'broker_carrier_invitations'
ORDER BY ordinal_position;

-- 17b. Constraints
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.broker_carrier_invitations'::regclass
ORDER BY conname;

-- 17c. Policies
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'broker_carrier_invitations';

-- 17d. Indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'broker_carrier_invitations';

-- ── STEP 18: Focused — platform_settings and platform_feature_flags ──────────

-- 18a. platform_settings
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'platform_settings'
ORDER BY ordinal_position;

SELECT * FROM public.platform_settings LIMIT 10;

-- 18b. platform_feature_flags
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'platform_feature_flags'
ORDER BY ordinal_position;

SELECT * FROM public.platform_feature_flags LIMIT 10;

-- ── STEP 19: Focused — onboarding_applications ───────────────────────────────

-- 19a. Column inventory
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'onboarding_applications'
ORDER BY ordinal_position;

-- 19b. Status distribution
SELECT status, applicant_type, COUNT(*) AS count
FROM public.onboarding_applications
GROUP BY status, applicant_type
ORDER BY status, applicant_type;

-- 19c. Policies
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'onboarding_applications';

-- ── STEP 20: Focused — jobs table ────────────────────────────────────────────

-- 20a. Status distribution
SELECT status, COUNT(*) AS count
FROM public.jobs
GROUP BY status
ORDER BY status;

-- 20b. Job columns (verify canonical fields present)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jobs'
  AND column_name IN (
    'id', 'company_id', 'status', 'current_status',
    'assigned_driver_id', 'pickup_location', 'delivery_location',
    'pickup_postcode', 'delivery_postcode', 'pickup_datetime', 'delivery_datetime',
    'budget_amount', 'is_fixed_price', 'distance_miles',
    'collection_photo_url', 'delivery_photos', 'pod_photos',
    'delivery_signature_data', 'client_signature_name', 'pod_required',
    'idempotency_key', 'awarded_carrier_company_id', 'booked_by_company_name',
    'client_name', 'client_phone', 'created_at', 'updated_at'
  )
ORDER BY ordinal_position;

-- ── STEP 21: Focused — invoices ──────────────────────────────────────────────

-- 21a. Status distribution
SELECT status, COUNT(*) AS count
FROM public.invoices
GROUP BY status
ORDER BY status;

-- 21b. Key columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'invoices'
ORDER BY ordinal_position;

-- ── STEP 22: Focused — company_memberships ───────────────────────────────────

-- 22a. Policies (verify canonical_company_membership_authorization applied)
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'company_memberships';

-- 22b. Helper functions
SELECT proname, prosecdef, pg_get_function_arguments(oid) AS args
FROM pg_proc
JOIN pg_namespace ON pg_namespace.oid = pronamespace
WHERE nspname = 'public'
  AND proname IN (
    'auth_company_id', 'is_company_member', 'active_company_membership_role',
    'is_platform_owner', 'is_super_admin', 'auth_user_role'
  )
ORDER BY proname;

-- ── STEP 23: Focused — required RPCs ─────────────────────────────────────────
-- Purpose: Verify all RPCs used by application code exist with correct signatures.

SELECT proname, pg_get_function_arguments(oid) AS arguments,
       pg_get_function_result(oid) AS returns,
       CASE prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'INVOKER' END AS security
FROM pg_proc
JOIN pg_namespace ON pg_namespace.oid = pronamespace
WHERE nspname = 'public'
  AND proname IN (
    'review_onboarding_application_atomic',
    'assign_job_driver_atomic',
    'get_or_create_company_for_user',
    'promote_to_platform_owner',
    'accept_bid_and_allocate',
    'submit_onboarding_application_atomic',
    'fn_notify_job_assigned',
    'fn_notify_bid_accepted',
    'fn_notify_pod_uploaded',
    'fn_bridge_notification_event_to_inbox',
    'fn_notification_event_title',
    'fn_notification_event_body'
  )
ORDER BY proname;

-- ── STEP 24: Check for orphaned service-role bypass policies ─────────────────
-- Purpose: Find any policy using USING (true) without a role restriction.
-- Expected: Only service_role policies should use USING (true).

SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR qual IS NULL)
  AND roles NOT @> ARRAY['service_role']
ORDER BY tablename, policyname;

-- ── STEP 25: cron jobs (if pg_cron extension installed) ──────────────────────

SELECT
  jobid,
  schedule,
  command,
  nodename,
  active
FROM cron.job
ORDER BY jobid;

-- (This will error if pg_cron is not installed — expected)

-- ── END OF AUDIT PACKAGE ─────────────────────────────────────────────────────
-- Next step after completing this audit:
-- 1. Apply bridge migration: 20260725160000_notification_events_to_notifications_bridge.sql
-- 2. Re-run STEP 15e to confirm trg_bridge_notification_event_to_inbox exists.
-- 3. Re-run STEP 16c to confirm notifications row count increases after next event.
-- 4. Return results to development team for status verification.
