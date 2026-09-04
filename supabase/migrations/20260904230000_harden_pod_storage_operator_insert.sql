-- Go-live hardening: the existing POD "operator" upload policy only checks that
-- the caller's company can see the job. Because policies are permissive, that lets
-- any authenticated company member with the same auth_company_id() upload a POD
-- object for that job. Require an actual company operator for this operator path.
-- Assigned drivers keep their separate, exact-assignment upload policy.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS "pod_photos_insert_operator_for_accessible_job" ON storage.objects;
CREATE POLICY "pod_photos_insert_operator_for_accessible_job"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pod-photos'
  AND public.auth_company_id() IS NOT NULL
  AND (storage.foldername(storage.objects.name))[1] = public.auth_company_id()::text
  AND public.is_company_operator(public.auth_company_id())
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id::text = (storage.foldername(storage.objects.name))[2]
      AND (
        j.company_id = public.auth_company_id()
        OR j.assigned_company_id = public.auth_company_id()
        OR j.awarded_carrier_company_id = public.auth_company_id()
      )
  )
);

DO $$
DECLARE
  v_check text;
BEGIN
  SELECT with_check
  INTO v_check
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'pod_photos_insert_operator_for_accessible_job';

  IF v_check IS NULL
     OR v_check NOT ILIKE '%is_company_operator%'
     OR v_check NOT ILIKE '%pod-photos%' THEN
    RAISE EXCEPTION 'POD operator upload policy did not harden as expected.';
  END IF;
END;
$$;

COMMIT;
