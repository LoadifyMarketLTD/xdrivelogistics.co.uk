-- Add POD payload fingerprint and collection proof idempotency key to jobs table.
-- These enable same-key/same-fingerprint replay (200) vs same-key/different-fingerprint
-- conflict detection (409) in the server-mediated POD workflow.
-- Do not apply to production without an authorised migration window.

alter table public.jobs
  add column if not exists pod_payload_fingerprint text;

comment on column public.jobs.pod_payload_fingerprint is
  'SHA-256 hex fingerprint of the first accepted POD payload (photoUris + recipientName hash). '
  'Used to distinguish replay (same key + same fingerprint) from conflict (same key + different fingerprint).';

alter table public.jobs
  add column if not exists collection_proof_idempotency_key text;

comment on column public.jobs.collection_proof_idempotency_key is
  'Stable idempotency key from the driver-mobile collection-proof submission. '
  'Prevents duplicate collection photo writes when the offline queue retries.';
