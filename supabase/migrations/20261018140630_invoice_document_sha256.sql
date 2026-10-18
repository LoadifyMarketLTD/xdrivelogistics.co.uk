ALTER TABLE public.invoice_documents
  ADD COLUMN IF NOT EXISTS content_sha256 text;

ALTER TABLE public.invoice_documents
  DROP CONSTRAINT IF EXISTS invoice_documents_content_sha256_check;

ALTER TABLE public.invoice_documents
  ADD CONSTRAINT invoice_documents_content_sha256_check
  CHECK (
    content_sha256 IS NULL
    OR content_sha256 ~ '^[0-9a-f]{64}$'
  );
