-- Add per-job POD upload ledger.
-- Each entry records one authorised evidence upload (evidenceId, podKey, payloadFingerprint,
-- canonical storage path, sha256Hex, byte size, MIME type, kind, issuedAt).
-- savePod verifies that all photoPaths / documentPaths submitted for finalisation are
-- present in this ledger with matching metadata, preventing arbitrary path injection.
-- Maximum 10 ledger entries per podKey are enforced at upload-init time.
-- Do not apply to production without an authorised migration window.

alter table public.jobs
  add column if not exists pod_upload_ledger jsonb not null default '[]'::jsonb;

comment on column public.jobs.pod_upload_ledger is
  'Append-only list of server-authorised POD evidence uploads for this job. '
  'Each entry: {evidenceId, podKey, payloadFingerprint, path, sha256Hex, byteSize, mimeType, kind, issuedAt}. '
  'savePod must verify all submitted paths are present in this ledger.';
