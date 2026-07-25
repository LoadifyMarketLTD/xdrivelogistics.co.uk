-- Column inventory snapshot for key tables affected by the four blocked migrations.
-- Run BEFORE any of the four blockers.
-- Table created with IF NOT EXISTS — safe to re-run.
-- No DROP COLUMN appears in any of the four blocked migrations, but this snapshot
-- provides a baseline for auditing structural changes before and after.

CREATE TABLE IF NOT EXISTS public.backup_blockers_column_inventory AS
SELECT
  now()            AS captured_at,
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema IN ('public', 'auth')
  AND table_name IN (
    'profiles',
    'invoices',
    'company_registration_claims',
    'company_registration_audit',
    'notification_events',
    'onboarding_applications',
    'drivers',
    'users'
  )
ORDER BY table_schema, table_name, ordinal_position;
