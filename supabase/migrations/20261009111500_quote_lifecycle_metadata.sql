begin;

alter table public.job_bids
  add column if not exists viewed_at timestamptz,
  add column if not exists shortlisted_at timestamptz,
  add column if not exists poster_archived_at timestamptz,
  add column if not exists bidder_archived_at timestamptz;

comment on column public.job_bids.viewed_at is
  'When the job-owning company first opened the submitted quote.';
comment on column public.job_bids.shortlisted_at is
  'When the job-owning company shortlisted the submitted quote.';
comment on column public.job_bids.poster_archived_at is
  'Per-poster archive marker for terminal quote records.';
comment on column public.job_bids.bidder_archived_at is
  'Per-bidder archive marker for terminal quote records.';

notify pgrst, 'reload schema';
commit;
