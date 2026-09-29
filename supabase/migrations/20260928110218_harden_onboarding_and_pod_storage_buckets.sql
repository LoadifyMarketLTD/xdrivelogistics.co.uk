BEGIN;

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[]
WHERE id = 'onboarding-documents';

UPDATE storage.buckets
SET file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id = 'pod-photos';

DO $verify$
DECLARE
  onboarding_limit bigint;
  pod_limit bigint;
BEGIN
  SELECT file_size_limit INTO onboarding_limit FROM storage.buckets WHERE id = 'onboarding-documents';
  SELECT file_size_limit INTO pod_limit FROM storage.buckets WHERE id = 'pod-photos';

  IF onboarding_limit <> 10485760 OR pod_limit <> 15728640 THEN
    RAISE EXCEPTION 'Storage bucket upload limits were not applied.'
      USING ERRCODE = '23514';
  END IF;
END;
$verify$;

COMMIT;
