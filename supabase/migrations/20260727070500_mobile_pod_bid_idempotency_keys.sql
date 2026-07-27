-- Persist mobile submission idempotency keys for POD and bid APIs.
-- This enables safe server-side replay handling for offline retries.

alter table public.jobs
  add column if not exists pod_submission_idempotency_key text;

comment on column public.jobs.pod_submission_idempotency_key is
  'Stable idempotency key from driver-mobile POD submission payload for replay safety.';

alter table public.job_bids
  add column if not exists mobile_submission_idempotency_key text;

comment on column public.job_bids.mobile_submission_idempotency_key is
  'Stable idempotency key from driver-mobile bid submission payload for replay safety.';

create unique index if not exists job_bids_mobile_submission_idempotency_uidx
  on public.job_bids (job_id, bidder_user_id, mobile_submission_idempotency_key)
  where mobile_submission_idempotency_key is not null;
