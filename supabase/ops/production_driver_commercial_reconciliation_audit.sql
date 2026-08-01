-- ============================================================
-- Production driver-commercial reconciliation audit
-- ============================================================
-- Purpose:
--   Read-only comparison package for the Production concerns that were
--   previously bundled into 20260801000000_p0_driver_commercial_columns_catchup.sql.
--
-- Usage:
--   Run each statement individually in Supabase SQL Editor against:
--     1. Production (read-only evidence capture)
--     2. Staging/disposable environment created from a Production-equivalent baseline
--
-- Important:
--   • This file performs NO writes.
--   • Do NOT apply Production SQL from this file.
--   • Record raw query output in the reconciliation runbook before any approval.
-- ============================================================

-- ── A1. drivers.driver_type / drivers.can_commercial_bid column inventory ──────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'drivers'
  AND column_name IN ('driver_type', 'can_commercial_bid')
ORDER BY column_name;

-- ── A2. drivers constraints touching driver_type / can_commercial_bid ───────────
SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.drivers'::regclass
  AND pg_get_constraintdef(oid) ILIKE '%driver_type%';

-- ── A3. drivers null / value distribution ───────────────────────────────────────
SELECT
  driver_type,
  can_commercial_bid,
  COUNT(*) AS row_count
FROM public.drivers
GROUP BY driver_type, can_commercial_bid
ORDER BY driver_type, can_commercial_bid;

-- ── A4. drivers rows that would block constraint-only reconciliation ────────────
SELECT
  id,
  user_id,
  company_id,
  driver_type,
  can_commercial_bid,
  status,
  app_access,
  created_at,
  updated_at
FROM public.drivers
WHERE driver_type IS NULL
   OR driver_type NOT IN ('owner_driver', 'company_driver')
   OR can_commercial_bid IS NULL
ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
LIMIT 200;

-- ── B1. Preserve-all-false-values audit ─────────────────────────────────────────
SELECT
  id,
  user_id,
  company_id,
  driver_type,
  status,
  app_access,
  can_commercial_bid,
  created_at,
  updated_at
FROM public.drivers
WHERE can_commercial_bid = false
ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST;

-- ── B2. False-row enrichment from onboarding / memberships (read-only) ─────────
WITH latest_onboarding AS (
  SELECT DISTINCT ON (oa.user_id)
    oa.user_id,
    oa.account_type,
    oa.status AS onboarding_status,
    oa.company_id AS onboarding_company_id,
    oa.updated_at,
    oa.created_at
  FROM public.onboarding_applications oa
  WHERE oa.user_id IS NOT NULL
  ORDER BY oa.user_id, oa.updated_at DESC NULLS LAST, oa.created_at DESC NULLS LAST
)
SELECT
  d.id AS driver_id,
  d.user_id,
  d.company_id,
  d.driver_type,
  d.status AS driver_status,
  d.app_access,
  d.can_commercial_bid,
  lo.account_type,
  lo.onboarding_status,
  lo.onboarding_company_id,
  cm.role_in_company,
  cm.status AS membership_status,
  d.updated_at
FROM public.drivers d
LEFT JOIN latest_onboarding lo
  ON lo.user_id = d.user_id
LEFT JOIN public.company_memberships cm
  ON cm.company_id IS NOT DISTINCT FROM d.company_id
 AND cm.user_id = d.user_id
WHERE d.can_commercial_bid = false
ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST;

-- ── C1. Duplicate compatibility for active company bids ─────────────────────────
SELECT
  job_id,
  company_id,
  COUNT(*) AS active_bid_count,
  array_agg(id ORDER BY created_at, id) AS bid_ids,
  array_agg(status ORDER BY created_at, id) AS statuses
FROM public.job_bids
WHERE company_id IS NOT NULL
  AND status IN ('submitted', 'accepted')
GROUP BY job_id, company_id
HAVING COUNT(*) > 1
ORDER BY active_bid_count DESC, job_id;

-- ── C2. Duplicate compatibility for active null-company bids ───────────────────
SELECT
  job_id,
  bidder_user_id,
  COUNT(*) AS active_bid_count,
  array_agg(id ORDER BY created_at, id) AS bid_ids,
  array_agg(status ORDER BY created_at, id) AS statuses
FROM public.job_bids
WHERE company_id IS NULL
  AND status IN ('submitted', 'accepted')
GROUP BY job_id, bidder_user_id
HAVING COUNT(*) > 1
ORDER BY active_bid_count DESC, job_id;

-- ── C3. Current index presence / definitions ────────────────────────────────────
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'job_bids'
  AND indexname IN (
    'job_bids_active_company_unique_idx',
    'job_bids_active_null_company_unique_idx'
  )
ORDER BY indexname;

-- ── D1. Live RLS definition of job_bids_exchange_insert ─────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'job_bids'
  AND policyname = 'job_bids_exchange_insert';

-- ── D2. All job_bids policies for overlap / drift review ────────────────────────
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'job_bids'
ORDER BY policyname;

-- ── E1. Live definition of review_onboarding_application_atomic ─────────────────
SELECT
  p.proname,
  md5(pg_get_functiondef(p.oid)) AS definition_hash,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'review_onboarding_application_atomic';

SELECT pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'review_onboarding_application_atomic';

-- ── E2. Helper dependencies for company activation / membership side effects ────
SELECT
  p.proname,
  md5(pg_get_functiondef(p.oid)) AS definition_hash,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'set_company_status_governance',
    'active_company_membership_role',
    'is_company_member',
    'auth_company_id'
  )
ORDER BY p.proname;

-- ── E3. company_memberships policy / constraint evidence ────────────────────────
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'company_memberships'
ORDER BY policyname;

SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.company_memberships'::regclass
ORDER BY conname;

-- ── F1. notification_events structure / policy / trigger evidence ──────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notification_events'
ORDER BY ordinal_position;

SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'notification_events'
ORDER BY policyname;

SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'notification_events'
ORDER BY trigger_name;

-- ── F2. Runtime evidence for onboarding review notification emission ────────────
SELECT
  event_type,
  status,
  COUNT(*) AS row_count,
  MAX(created_at) AS latest_created_at
FROM public.notification_events
WHERE event_type IN ('onboarding_approved', 'onboarding_review_updated')
GROUP BY event_type, status
ORDER BY event_type, status;

SELECT
  id,
  event_type,
  entity_type,
  entity_id,
  company_id,
  recipient_user_id,
  status,
  created_at,
  processed_at
FROM public.notification_events
WHERE event_type IN ('onboarding_approved', 'onboarding_review_updated')
ORDER BY created_at DESC
LIMIT 50;

-- ── G1. Emergency manual repairs that must be reconciled ────────────────────────
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'company_documents' AND column_name = 'issued_date')
    OR (table_name = 'driver_identity_documents' AND column_name = 'issued_date')
  )
ORDER BY table_name, column_name;

SELECT
  p.proname,
  md5(pg_get_functiondef(p.oid)) AS definition_hash,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'owner_review_compliance_document';

SELECT pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'owner_review_compliance_document';
