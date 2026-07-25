-- Preflight check for 20260723205200_harden_verified_company_claims.sql
--
-- Run this BEFORE applying migration 20260723205200.
--
-- Returns the exact rows in public.company_registration_claims that would be
-- DELETED by the migration — i.e., claims without a provider-backed
-- Companies House audit event (action IN ('created','reused'),
-- source = 'companies_house_server_validation', registry_status = 'active').
--
-- GATE: Review every returned row.
-- If any row belongs to a company that is still going through active onboarding,
-- resolve manually before proceeding.
-- An empty result set means the migration is safe to run immediately.
--
-- Safe to run read-only at any time.

SELECT
  claim.company_number,
  claim.company_id,
  claim.claimed_by,
  claim.registry_status,
  claim.registry_name,
  claim.created_at,
  claim.updated_at,
  -- Additional context: is this company_id linked to any onboarding in progress?
  EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.company_id = claim.company_id
      AND oa.status IN ('draft', 'in_progress', 'submitted', 'under_review', 'request_changes')
  ) AS has_active_onboarding,
  -- Is the company itself in a pending state?
  (
    SELECT c.status::text
    FROM public.companies c
    WHERE c.id = claim.company_id
  ) AS company_status
FROM public.company_registration_claims claim
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_registration_audit audit
  WHERE audit.company_id     = claim.company_id
    AND audit.company_number = claim.company_number
    AND audit.actor_user_id  = claim.claimed_by
    AND audit.action         IN ('created', 'reused')
    AND audit.metadata->>'source' = 'companies_house_server_validation'
    AND lower(coalesce(audit.metadata->>'registry_status', '')) = 'active'
)
ORDER BY claim.company_number;
