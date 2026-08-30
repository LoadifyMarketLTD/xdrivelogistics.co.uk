-- Hosted first in production after owner-driver document upload audit.
-- Align driver-docs MIME policy with the application contract and normalize
-- only legacy signed URLs whose underlying object can be proven to exist.
-- Deliberately does not delete orphan storage objects.

BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]::text[]
WHERE id = 'driver-docs';

WITH candidates AS (
  SELECT
    dd.id,
    CASE
      WHEN dd.file_path LIKE '%/storage/v1/object/sign/driver-docs/%'
        THEN split_part(split_part(dd.file_path, '/storage/v1/object/sign/driver-docs/', 2), '?', 1)
      WHEN dd.file_path LIKE '%/storage/v1/object/public/driver-docs/%'
        THEN split_part(split_part(dd.file_path, '/storage/v1/object/public/driver-docs/', 2), '?', 1)
      WHEN dd.file_path LIKE '%/storage/v1/object/authenticated/driver-docs/%'
        THEN split_part(split_part(dd.file_path, '/storage/v1/object/authenticated/driver-docs/', 2), '?', 1)
      ELSE NULL
    END AS object_path
  FROM public.driver_documents dd
  WHERE dd.file_path LIKE 'http%'
), verified AS (
  SELECT c.id, c.object_path
  FROM candidates c
  WHERE c.object_path IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM storage.objects o
      WHERE o.bucket_id = 'driver-docs'
        AND o.name = c.object_path
    )
)
UPDATE public.driver_documents dd
SET file_path = verified.object_path
FROM verified
WHERE dd.id = verified.id;

WITH candidates AS (
  SELECT
    vd.id,
    CASE
      WHEN vd.file_path LIKE '%/storage/v1/object/sign/driver-docs/%'
        THEN split_part(split_part(vd.file_path, '/storage/v1/object/sign/driver-docs/', 2), '?', 1)
      WHEN vd.file_path LIKE '%/storage/v1/object/public/driver-docs/%'
        THEN split_part(split_part(vd.file_path, '/storage/v1/object/public/driver-docs/', 2), '?', 1)
      WHEN vd.file_path LIKE '%/storage/v1/object/authenticated/driver-docs/%'
        THEN split_part(split_part(vd.file_path, '/storage/v1/object/authenticated/driver-docs/', 2), '?', 1)
      ELSE NULL
    END AS object_path
  FROM public.vehicle_documents vd
  WHERE vd.file_path LIKE 'http%'
), verified AS (
  SELECT c.id, c.object_path
  FROM candidates c
  WHERE c.object_path IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM storage.objects o
      WHERE o.bucket_id = 'driver-docs'
        AND o.name = c.object_path
    )
)
UPDATE public.vehicle_documents vd
SET file_path = verified.object_path
FROM verified
WHERE vd.id = verified.id;

COMMIT;
