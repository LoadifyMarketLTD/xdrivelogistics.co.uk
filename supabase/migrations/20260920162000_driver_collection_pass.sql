begin;

alter table public.jobs
  add column if not exists collection_pass_required boolean not null default false;

create table if not exists public.driver_collection_passes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  token_hash text not null,
  code_last4 text not null,
  status text not null default 'active' check (status in ('active','verified','revoked','expired')),
  expires_at timestamptz not null,
  activated_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by_user_id uuid references auth.users(id) on delete set null,
  verify_attempts integer not null default 0 check (verify_attempts >= 0),
  last_attempt_at timestamptz,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_collection_passes_driver_idx
  on public.driver_collection_passes(driver_id, status);
create index if not exists driver_collection_passes_expiry_idx
  on public.driver_collection_passes(expires_at);

alter table public.driver_collection_passes enable row level security;
revoke all on table public.driver_collection_passes from public, anon, authenticated;
grant all on table public.driver_collection_passes to service_role;

commit;
