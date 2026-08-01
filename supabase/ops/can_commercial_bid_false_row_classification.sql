-- ============================================================
-- can_commercial_bid false-row classification worksheet
-- ============================================================
-- Purpose:
--   Read-only worksheet for every Production driver row where
--   can_commercial_bid = false.
--
-- Rule:
--   DO NOT update any row from this worksheet directly.
--   Each false row must be explicitly classified and approved before any
--   targeted data reconciliation is written.
-- ============================================================

WITH latest_onboarding AS (
  SELECT DISTINCT ON (oa.user_id)
    oa.user_id,
    oa.account_type,
    oa.status AS onboarding_status,
    oa.company_id AS onboarding_company_id,
    oa.reviewed_at,
    oa.updated_at,
    oa.created_at
  FROM public.onboarding_applications oa
  WHERE oa.user_id IS NOT NULL
  ORDER BY oa.user_id, oa.updated_at DESC NULLS LAST, oa.created_at DESC NULLS LAST
),
latest_membership AS (
  SELECT DISTINCT ON (cm.company_id, cm.user_id)
    cm.company_id,
    cm.user_id,
    cm.role_in_company,
    cm.status AS membership_status,
    cm.updated_at
  FROM public.company_memberships cm
  ORDER BY cm.company_id, cm.user_id, cm.updated_at DESC NULLS LAST
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
  lm.role_in_company,
  lm.membership_status,
  CASE
    WHEN d.can_commercial_bid IS DISTINCT FROM false THEN 'OUT OF SCOPE'
    WHEN COALESCE(d.status::text, '') IN ('blocked', 'inactive', 'suspended') THEN 'LIKELY PRESERVE FALSE'
    WHEN d.app_access = false THEN 'LIKELY PRESERVE FALSE'
    WHEN d.driver_type IS NULL THEN 'BLOCKED — CLASSIFY DRIVER TYPE FIRST'
    ELSE 'REQUIRES EXPLICIT HUMAN CLASSIFICATION'
  END AS review_bucket,
  d.created_at,
  d.updated_at
FROM public.drivers d
LEFT JOIN latest_onboarding lo
  ON lo.user_id = d.user_id
LEFT JOIN latest_membership lm
  ON lm.company_id IS NOT DISTINCT FROM d.company_id
 AND lm.user_id = d.user_id
WHERE d.can_commercial_bid = false
ORDER BY review_bucket, d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST;
