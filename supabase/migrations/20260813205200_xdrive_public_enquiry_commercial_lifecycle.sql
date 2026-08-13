alter table public.quotes
  add column if not exists updated_at timestamptz,
  add column if not exists quote_sent_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_job_id uuid references public.jobs(id) on delete set null,
  add column if not exists execution_mode text;

alter table public.quotes
  drop constraint if exists quotes_execution_mode_valid;

alter table public.quotes
  add constraint quotes_execution_mode_valid
  check (execution_mode is null or execution_mode in ('own_fleet','direct_carrier','marketplace'));

create index if not exists idx_quotes_converted_job_id
  on public.quotes(converted_job_id)
  where converted_job_id is not null;
