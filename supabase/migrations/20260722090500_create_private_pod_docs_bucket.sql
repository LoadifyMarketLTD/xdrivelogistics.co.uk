BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pod-docs',
  'pod-docs',
  false,
  15728640,
  ARRAY[
    'application/pdf',
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS pod_docs_insert_assigned_driver ON storage.objects;
CREATE POLICY pod_docs_insert_assigned_driver
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pod-docs'
  AND (storage.foldername(name))[2] IN ('photos', 'documents')
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.drivers d
      ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[1]
      AND d.user_id = auth.uid()
      AND d.app_access = true
      AND lower(coalesce(d.status::text, '')) = 'active'
      AND lower(coalesce(j.status::text, '')) NOT IN ('cancelled', 'disputed')
  )
);

DROP POLICY IF EXISTS pod_docs_select_authorised_workspace ON storage.objects;
CREATE POLICY pod_docs_select_authorised_workspace
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pod-docs'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    LEFT JOIN public.drivers d
      ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[1]
      AND (
        d.user_id = auth.uid()
        OR j.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.user_id = auth.uid()
            AND cm.status = 'active'
            AND cm.company_id IN (j.company_id, j.awarded_carrier_company_id)
        )
      )
  )
);

DROP POLICY IF EXISTS pod_docs_delete_assigned_driver ON storage.objects;
CREATE POLICY pod_docs_delete_assigned_driver
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pod-docs'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.drivers d
      ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[1]
      AND d.user_id = auth.uid()
      AND d.app_access = true
      AND lower(coalesce(d.status::text, '')) = 'active'
      AND lower(coalesce(j.status::text, '')) NOT IN ('delivered', 'completed', 'invoiced', 'paid')
  )
);

DO $$
DECLARE
  v_bucket_public boolean;
  v_policy_count integer;
BEGIN
  SELECT public
  INTO v_bucket_public
  FROM storage.buckets
  WHERE id = 'pod-docs';

  IF v_bucket_public IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Private POD bucket reconciliation failed.';
  END IF;

  SELECT count(*)
  INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN (
      'pod_docs_insert_assigned_driver',
      'pod_docs_select_authorised_workspace',
      'pod_docs_delete_assigned_driver'
    );

  IF v_policy_count <> 3 THEN
    RAISE EXCEPTION 'POD storage policy reconciliation failed: % / 3 policies found.', v_policy_count;
  END IF;
END
$$;

COMMIT;
