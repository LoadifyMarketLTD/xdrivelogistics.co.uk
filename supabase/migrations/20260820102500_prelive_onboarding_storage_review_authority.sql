-- Branch Guardian follow-up for the PreLive onboarding Storage P0.
--
-- Direct Storage review does not need a company-admin branch. Company workspace
-- access already goes through /api/company/documents/signed-url, which verifies
-- active company membership, document.company_id, onboarding source ownership
-- and the canonical {user_id}/{application_id}/... object path before using the
-- service role to create a short-lived signed URL.
--
-- Keep direct authenticated bucket-wide review exclusively with Platform Owner.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS onboarding_docs_select_reviewer ON storage.objects;
DROP POLICY IF EXISTS onboarding_docs_select_tenant_reviewer ON storage.objects;
DROP POLICY IF EXISTS onboarding_docs_select_platform_owner ON storage.objects;

CREATE POLICY onboarding_docs_select_platform_owner
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'onboarding-documents'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'owner'
      AND COALESCE(p.status::text, '') = 'active'
  )
);

-- PreLive P0 final boundary: authenticated direct global review of
-- onboarding-documents is Platform Owner only. Company members use the
-- tenant-validated server signed-URL API for their own company documents.
--
-- Deliberately kept as a SQL source comment rather than COMMENT ON POLICY:
-- storage.objects is owned by Supabase's storage service role in local/hosted
-- environments, so COMMENT ON POLICY is not portable from the migration role.

NOTIFY pgrst, 'reload schema';
COMMIT;
