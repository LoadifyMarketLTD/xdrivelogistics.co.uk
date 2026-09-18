BEGIN;

-- Canonical job attachment fields used by current web/mobile readers.
-- Preserve the legacy file_url/file_type aliases for backward compatibility.
ALTER TABLE public.job_documents
  ADD COLUMN IF NOT EXISTS doc_type text,
  ADD COLUMN IF NOT EXISTS file_path text;

UPDATE public.job_documents
SET doc_type = COALESCE(NULLIF(doc_type, ''), NULLIF(file_type, '')),
    file_path = COALESCE(NULLIF(file_path, ''), NULLIF(file_url, '')),
    file_type = COALESCE(NULLIF(file_type, ''), NULLIF(doc_type, '')),
    file_url = COALESCE(NULLIF(file_url, ''), NULLIF(file_path, ''))
WHERE doc_type IS NULL
   OR file_path IS NULL
   OR file_type IS NULL
   OR file_url IS NULL;

COMMENT ON COLUMN public.job_documents.doc_type IS
  'Canonical job attachment classification. Legacy alias: file_type.';
COMMENT ON COLUMN public.job_documents.file_path IS
  'Stable private load-documents object path. Legacy alias: file_url.';

-- Keep raw browser writes closed. Server-authoritative APIs persist metadata.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.job_documents FROM authenticated;
GRANT SELECT ON TABLE public.job_documents TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
