-- Persist the in-progress driver POD across browser restarts and sign-ins.
-- Final POD remains authoritative in record_driver_pod_atomic; this table is
-- for drafts only and is never a parallel booking state machine.
create table if not exists public.driver_pod_drafts (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  form_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_pod_drafts_object check (jsonb_typeof(form_data) = 'object'),
  constraint driver_pod_drafts_max_bytes check (octet_length(form_data::text) <= 3000000)
);
create index if not exists driver_pod_drafts_driver_idx on public.driver_pod_drafts(driver_id);
alter table public.driver_pod_drafts enable row level security;
revoke all on public.driver_pod_drafts from anon, authenticated;
grant all on public.driver_pod_drafts to service_role;
comment on table public.driver_pod_drafts is 'Private, driver-bound POD draft only. Final POD and lifecycle are stored by canonical XDrive atomic RPC.';
