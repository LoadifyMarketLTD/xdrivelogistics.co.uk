-- Provider-neutral telematics identity bindings.
-- Deliberately fail-closed to direct clients: integration routes use the service
-- role after authenticating the provider request and still validate active job
-- assignment before a location sample can be accepted.

create table if not exists public.telematics_driver_bindings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_driver_id text not null,
  external_vehicle_id text,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_driver_id),
  check (provider ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  check (length(external_driver_id) between 1 and 200),
  check (external_vehicle_id is null or length(external_vehicle_id) between 1 and 200)
);

create index if not exists idx_telematics_driver_bindings_driver
  on public.telematics_driver_bindings(driver_id)
  where enabled = true;
create index if not exists idx_telematics_driver_bindings_company
  on public.telematics_driver_bindings(company_id)
  where enabled = true;

alter table public.telematics_driver_bindings enable row level security;

comment on table public.telematics_driver_bindings is
  'Maps provider-native driver identifiers to canonical XDrive drivers for signed telematics ingestion. Direct client access is fail-closed.';
comment on column public.telematics_driver_bindings.external_vehicle_id is
  'Optional provider vehicle identifier retained for reconciliation; canonical job/driver authorization remains authoritative.';
