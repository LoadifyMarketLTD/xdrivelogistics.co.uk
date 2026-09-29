BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Keep the Storage reviewer helper aligned with the canonical tenant reviewer
-- policies: only an active Platform Owner can review cross-company evidence;
-- tenant owner/admin users are limited to evidence belonging to their company.
CREATE OR REPLACE FUNCTION public.can_review_onboarding_storage_object(
  p_bucket_id text,
  p_object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  WITH actor AS (
    SELECT auth.uid() AS user_id
  ),
  platform_owner AS (
    SELECT public.is_owner(actor.user_id) AS allowed
    FROM actor
  ),
  matching_driver_evidence AS (
    SELECT oa.company_id
    FROM public.driver_identity_documents d
    JOIN public.onboarding_applications oa
      ON oa.id = d.onboarding_application_id
    WHERE d.file_path IS NOT NULL
      AND d.file_path <> ''
      AND (
        d.file_path = p_object_name
        OR d.file_path = p_bucket_id || '/' || p_object_name
        OR d.file_path LIKE '%' || p_object_name
      )
  ),
  matching_company_evidence AS (
    SELECT COALESCE(c.company_id, oa.company_id) AS company_id
    FROM public.company_documents c
    LEFT JOIN public.onboarding_applications oa
      ON oa.id = c.onboarding_application_id
    WHERE c.file_path IS NOT NULL
      AND c.file_path <> ''
      AND (
        c.file_path = p_object_name
        OR c.file_path = p_bucket_id || '/' || p_object_name
        OR c.file_path LIKE '%' || p_object_name
      )
  ),
  matching_companies AS (
    SELECT company_id FROM matching_driver_evidence
    UNION
    SELECT company_id FROM matching_company_evidence
  )
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM matching_companies WHERE company_id IS NOT NULL)
    AND (
      COALESCE((SELECT allowed FROM platform_owner), false)
      OR EXISTS (
        SELECT 1
        FROM matching_companies evidence
        JOIN public.company_memberships cm
          ON cm.company_id = evidence.company_id
        JOIN public.companies company
          ON company.id = cm.company_id
        WHERE cm.user_id = auth.uid()
          AND COALESCE(cm.status::text, '') = 'active'
          AND COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin')
          AND COALESCE(company.status::text, '') = 'active'
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_review_onboarding_storage_object(text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_onboarding_storage_object(text, text)
TO authenticated, service_role;

-- The company-members helper participates directly in RLS. Do not let a
-- suspended company, inactive Platform Owner, or stale creator relationship
-- retain member-management authority.
CREATE OR REPLACE FUNCTION public.can_manage_company_members(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    _company_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.company_members cm
        JOIN public.companies c ON c.id = cm.company_id
        WHERE cm.company_id = _company_id
          AND cm.user_id = auth.uid()
          AND COALESCE(cm.is_active, true) = true
          AND COALESCE(cm.company_role, cm.member_role::text)
              IN ('owner','admin','broker_admin','carrier_admin')
          AND COALESCE(c.status::text, '') = 'active'
      )
      OR EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = _company_id
          AND c.created_by = auth.uid()
          AND COALESCE(c.status::text, '') = 'active'
      )
      OR public.is_owner(auth.uid())
    );
$function$;

REVOKE ALL ON FUNCTION public.can_manage_company_members(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_company_members(uuid)
TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
