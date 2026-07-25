-- Backup: company_registration_claims (full snapshot + to-delete subset)
-- before migration 20260723205200_harden_verified_company_claims.sql
--
-- Run BOTH statements, one at a time, BEFORE applying migration 20260723205200.
-- Tables are created with IF NOT EXISTS — safe to re-run.
--
-- Statement 1: Full snapshot of all current claims.
-- Statement 2: Subset that would be deleted by the migration.
--
-- ─────────────────────────────────────────────────────────
-- STATEMENT 1 — Full claims snapshot
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.backup_20260723205200_company_registration_claims AS
SELECT
  now() AS backed_up_at,
  c.*
FROM public.company_registration_claims c;

-- ─────────────────────────────────────────────────────────
-- STATEMENT 2 — Claims that WILL BE DELETED by the migration
-- Run this after Statement 1 to capture the exact deletion scope.
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.backup_20260723205200_company_registration_claims_to_delete AS
SELECT
  now() AS backed_up_at,
  c.*
FROM public.company_registration_claims c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_registration_audit a
  WHERE a.company_id     = c.company_id
    AND a.company_number = c.company_number
    AND a.actor_user_id  = c.claimed_by
    AND a.action         IN ('created', 'reused')
    AND a.metadata->>'source' = 'companies_house_server_validation'
    AND lower(coalesce(a.metadata->>'registry_status', '')) = 'active'
);
