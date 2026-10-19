UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[]
WHERE id = 'pod-photos';

DO $$
DECLARE configured text[];
BEGIN
  SELECT allowed_mime_types INTO configured FROM storage.buckets WHERE id = 'pod-photos';
  IF configured IS NULL OR NOT ('application/pdf' = ANY(configured)) OR NOT ('image/jpeg' = ANY(configured)) OR NOT ('image/png' = ANY(configured)) THEN
    RAISE EXCEPTION 'POD evidence MIME configuration was not applied.';
  END IF;
END $$;
