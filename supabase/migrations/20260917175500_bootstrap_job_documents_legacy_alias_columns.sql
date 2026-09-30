BEGIN;

-- Hosted job_documents still carries the legacy file_type/file_url aliases.
-- The following canonical-alignment migration reads those aliases while
-- backfilling doc_type/file_path, so fresh databases must expose them first.
ALTER TABLE public.job_documents
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS file_url text;

COMMIT;