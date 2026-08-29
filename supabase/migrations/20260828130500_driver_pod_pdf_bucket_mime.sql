-- Align the tenant-scoped pod-photos bucket with the driver mobile POD API.
-- The API accepts PDF documents as POD evidence, while the original bucket
-- migration only allowed image MIME types. Preserve any existing bucket MIME
-- configuration and add application/pdf only when the bucket is restricted.

DO $$
DECLARE
  v_allowed_mime_types text[];
BEGIN
  SELECT allowed_mime_types
  INTO v_allowed_mime_types
  FROM storage.buckets
  WHERE id = 'pod-photos'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Required storage bucket pod-photos does not exist';
  END IF;

  -- NULL means the bucket is unrestricted, in which case PDF is already
  -- permitted and narrowing the bucket here would be an unsafe side effect.
  IF v_allowed_mime_types IS NOT NULL
     AND NOT ('application/pdf' = ANY(v_allowed_mime_types)) THEN
    UPDATE storage.buckets
    SET allowed_mime_types = array_append(v_allowed_mime_types, 'application/pdf')
    WHERE id = 'pod-photos';
  END IF;
END
$$;
