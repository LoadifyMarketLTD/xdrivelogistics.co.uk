-- Multi-drop execution foundation.
-- This table is deliberately fail-closed: RLS is enabled and no direct client
-- policies are created here. Authorised server routes must scope access through
-- the parent job before exposing or mutating stop data.

create table if not exists public.job_stops (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  stop_type text not null check (stop_type in ('collection', 'delivery')),
  address text not null,
  postcode text,
  company_name text,
  contact_name text,
  contact_phone text,
  window_start timestamptz,
  window_end timestamptz,
  instructions text,
  status text not null default 'pending'
    check (status in ('pending', 'arrived', 'completed', 'skipped')),
  arrived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, sequence),
  check (window_end is null or window_start is null or window_end >= window_start),
  check (completed_at is null or status in ('completed', 'skipped'))
);

create index if not exists idx_job_stops_job_sequence
  on public.job_stops(job_id, sequence);
create index if not exists idx_job_stops_job_status
  on public.job_stops(job_id, status, sequence);

alter table public.job_stops enable row level security;

revoke all on table public.job_stops from public, anon, authenticated;
grant all on table public.job_stops to service_role;

comment on table public.job_stops is
  'Ordered collection/delivery stops for multi-drop execution. Direct client access is fail-closed; server routes must authorize through the parent job.';
comment on column public.job_stops.sequence is
  'Stable execution order within the parent job; starts at 1.';
comment on column public.job_stops.status is
  'Stop-local execution state only. It must not replace or mutate the canonical parent job lifecycle implicitly.';
