-- Preflight check for 20260720121500_p0_database_security_and_schema_consistency.sql
--
-- Run this BEFORE applying migration 20260720121500.
-- All counts should be 0 before proceeding.
-- If any count > 0, fix the data first and re-run.
--
-- Safe to run read-only at any time.

WITH invalid_membership_roles AS (
  SELECT company_id, user_id, role_in_company::text AS role_value
  FROM public.company_memberships
  WHERE role_in_company::text NOT IN (
    'owner', 'admin', 'dispatcher', 'finance', 'member', 'viewer', 'driver'
  )
),
invalid_membership_status AS (
  SELECT company_id, user_id, status::text AS status_value
  FROM public.company_memberships
  WHERE status::text NOT IN ('active', 'invited', 'disabled', 'suspended')
),
orphan_driver_company AS (
  SELECT d.id AS driver_id, d.company_id, d.user_id
  FROM public.drivers d
  LEFT JOIN public.companies c ON c.id = d.company_id
  WHERE c.id IS NULL
),
orphan_driver_user AS (
  SELECT d.id AS driver_id, d.company_id, d.user_id
  FROM public.drivers d
  LEFT JOIN auth.users u ON u.id = d.user_id
  WHERE d.user_id IS NOT NULL
    AND u.id IS NULL
),
token_payload_rows AS (
  SELECT id, payload
  FROM public.notification_events
  WHERE payload ?| ARRAY['onboarding_url', 'token', 'raw_token', 'onboarding_token']
)
SELECT jsonb_build_object(
  'invalid_membership_roles_count',       (SELECT count(*) FROM invalid_membership_roles),
  'invalid_membership_status_count',      (SELECT count(*) FROM invalid_membership_status),
  'orphan_driver_company_count',          (SELECT count(*) FROM orphan_driver_company),
  'orphan_driver_user_count',             (SELECT count(*) FROM orphan_driver_user),
  'notification_payload_rows_to_scrub_count', (SELECT count(*) FROM token_payload_rows)
) AS preflight_20260720121500;
