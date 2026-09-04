-- Go-live hardening: replace hosted legacy reviewer policies that treated a
-- generic profile role `admin` as a global reviewer. Platform Owner keeps global
-- review visibility; company owner/admin visibility is limited to its own active
-- company. Existing self-service/owner-of-application policies remain intact.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS reviewers_read_onboarding_applications
  ON public.onboarding_applications;
DROP POLICY IF EXISTS reviewers_read_company_documents
  ON public.company_documents;
DROP POLICY IF EXISTS reviewers_read_driver_identity_documents
  ON public.driver_identity_documents;

CREATE POLICY onboarding_applications_select_tenant_reviewer
ON public.onboarding_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.role = 'owner'
      AND COALESCE(p.status::text, '') = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.user_id = (SELECT auth.uid())
      AND cm.company_id = onboarding_applications.company_id
      AND COALESCE(cm.status::text, '') = 'active'
      AND COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin')
  )
);

CREATE POLICY company_documents_select_tenant_reviewer
ON public.company_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.role = 'owner'
      AND COALESCE(p.status::text, '') = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.user_id = (SELECT auth.uid())
      AND COALESCE(cm.status::text, '') = 'active'
      AND COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin')
      AND (
        cm.company_id = company_documents.company_id
        OR EXISTS (
          SELECT 1
          FROM public.onboarding_applications oa
          WHERE oa.id = company_documents.onboarding_application_id
            AND oa.company_id = cm.company_id
        )
      )
  )
);

CREATE POLICY driver_identity_documents_select_tenant_reviewer
ON public.driver_identity_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.role = 'owner'
      AND COALESCE(p.status::text, '') = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    JOIN public.company_memberships cm
      ON cm.company_id = oa.company_id
     AND cm.user_id = (SELECT auth.uid())
     AND COALESCE(cm.status::text, '') = 'active'
     AND COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin')
    WHERE oa.id = driver_identity_documents.onboarding_application_id
  )
);

COMMIT;
