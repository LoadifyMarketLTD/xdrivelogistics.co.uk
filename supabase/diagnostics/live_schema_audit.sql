-- live_schema_audit.sql
-- Run this in Supabase SQL Editor BEFORE applying any further migrations.
-- Purpose: confirm exact production column and policy state for the 6 operational tables.

-- ── 1. Column presence audit ──────────────────────────────────────────────────
-- Expected: created_by on jobs, job_notes, job_tracking_events, quotes, invoices
--           uploaded_by on job_documents
--           created_by on loads, documents (secondary tables)
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.column_default,
  c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'jobs','job_notes','job_tracking_events',
    'quotes','invoices','job_documents',
    'loads','documents'
  )
  AND c.column_name IN ('created_by','uploaded_by')
ORDER BY c.table_name, c.column_name;

-- ── 2. Live policy audit for the 6 primary operational tables ─────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'jobs','job_notes','job_tracking_events',
    'quotes','invoices','job_documents'
  )
ORDER BY tablename, cmd, policyname;

-- ── 3. Helper functions present ───────────────────────────────────────────────
SELECT
  proname   AS function_name,
  prosecdef AS security_definer
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'is_company_member',
    'is_company_non_driver',
    'is_company_admin',
    'is_company_operator',
    'can_non_driver_access_job',
    'can_operator_access_job',
    'can_admin_manage_job'
  )
ORDER BY proname;

-- ── 4. Partial migration 035 state: which policies from 035 are live ──────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'jobs_insert_operator',
    'jobs_update_creator_or_admin',
    'jobs_delete_creator_or_admin',
    'job_documents_insert_operator',
    'job_documents_update_uploader_or_admin',
    'job_documents_delete_uploader_or_admin',
    'job_notes_insert_operator',
    'job_notes_update_creator_or_admin',
    'job_notes_delete_creator_or_admin',
    'job_tracking_insert_operator',
    'job_tracking_update_creator_or_admin',
    'job_tracking_delete_creator_or_admin',
    'quotes_insert_operator',
    'quotes_update_creator_or_admin',
    'quotes_delete_creator_or_admin',
    'invoices_insert_operator',
    'invoices_update_creator_or_admin',
    'invoices_delete_creator_or_admin'
  )
ORDER BY tablename, policyname;

-- ── 5. Column defaults currently set ─────────────────────────────────────────
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'jobs','job_notes','job_tracking_events',
    'quotes','invoices','job_documents',
    'loads','documents'
  )
  AND column_name IN ('created_by','uploaded_by')
  AND column_default IS NOT NULL
ORDER BY table_name;
