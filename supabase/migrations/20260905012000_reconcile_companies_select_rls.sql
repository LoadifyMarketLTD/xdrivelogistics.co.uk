-- Reconcile company SELECT authorization after clean-replay validation exposed
-- a legacy correlated-subquery bug in companies_select_member_or_creator.
--
-- The legacy predicate used `company_id = id` inside the membership subquery;
-- PostgreSQL resolves both names against company_memberships there, producing
-- `company_memberships.company_id = company_memberships.id` instead of binding
-- the outer companies row. Consolidate the overlapping hosted/replay policies
-- onto the canonical active-membership helper.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP POLICY IF EXISTS companies_select_member_or_creator ON public.companies;
DROP POLICY IF EXISTS companies_select_owner_all ON public.companies;
DROP POLICY IF EXISTS companies_select_owner_or_member_safe ON public.companies;

CREATE POLICY companies_select_authorized
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    companies.created_by = (SELECT auth.uid())
    OR public.is_company_member(companies.id)
    OR public.is_owner((SELECT auth.uid()))
  );

COMMIT;
