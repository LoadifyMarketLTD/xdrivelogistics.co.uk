-- Reconcile the private POD storage contract used by the web and driver apps.
--
-- Canonical object paths:
--   {job_id}/photos/{filename}
--   {job_id}/documents/{filename}
--
-- The bucket remains private. Files are exposed to authorised users only through
-- the server-side signed URL endpoint. Direct authenticated uploads are limited
-- to the active, approved driver currently assigned to the job.

BEGIN;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'pod-docs',
  'pod-docs',
  false,
  15728640,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "pod_docs_insert_assigned_driver" ON storage.objects;
CREATE POLICY "pod_docs_insert_assigned_driver"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pod-docs'
  AND (storage.foldername(name))[2] IN ('photos', 'documents')
  AND EXISTS (
    SELECT 1
    FROM public.jobs AS j
    JOIN public.drivers AS d
      ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[1]
      AND d.user_id = auth.uid()
      AND d.app_access = true
      AND coalesce(d.is_active, true) = true
      AND lower(coalesce(d.status::text, 'active')) = 'active'
      AND (
        j.assigned_company_id = d.company_id
        OR j.awarded_carrier_company_id = d.company_id
        OR (
          j.assigned_company_id IS NULL
          AND j.awarded_carrier_company_id IS NULL
          AND j.company_id = d.company_id
        )
      )
  )
);

-- Drivers may remove an object for their currently assigned job before the POD
-- submission is finalised. Direct reads remain denied; authorised downloads use
-- the server-side signed URL endpoint.
DROP POLICY IF EXISTS "pod_docs_delete_assigned_driver" ON storage.objects;
CREATE POLICY "pod_docs_delete_assigned_driver"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pod-docs'
  AND (storage.foldername(name))[2] IN ('photos', 'documents')
  AND EXISTS (
    SELECT 1
    FROM public.jobs AS j
    JOIN public.drivers AS d
      ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[1]
      AND d.user_id = auth.uid()
      AND d.app_access = true
      AND coalesce(d.is_active, true) = true
      AND lower(coalesce(d.status::text, 'active')) = 'active'
      AND (
        j.assigned_company_id = d.company_id
        OR j.awarded_carrier_company_id = d.company_id
        OR (
          j.assigned_company_id IS NULL
          AND j.awarded_carrier_company_id IS NULL
          AND j.company_id = d.company_id
        )
      )
  )
);

COMMIT;
