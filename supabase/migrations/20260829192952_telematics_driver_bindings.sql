-- Provider-neutral telematics identity bindings.
-- Deliberately fail-closed to direct clients: integration routes use the service
-- role after authenticating the provider request and still validate active job,
-- company, driver and canonical vehicle assignment before accepting a sample.

create table if not exists public.telematics_driver_bindings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_driver_id text not null,
  external_vehicle_id text not null,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  enabled boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_driver_id),
  unique (provider, external_vehicle_id),
  check (provider ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  check (length(external_driver_id) between 1 and 200),
  check (length(external_vehicle_id) between 1 and 200),
  check (revoked_at is null or enabled = false)
);

create index if not exists idx_telematics_driver_bindings_driver
  on public.telematics_driver_bindings(driver_id)
  where enabled = true and revoked_at is null;
create index if not exists idx_telematics_driver_bindings_vehicle
  on public.telematics_driver_bindings(vehicle_id)
  where enabled = true and revoked_at is null;
create index if not exists idx_telematics_driver_bindings_company
  on public.telematics_driver_bindings(company_id)
  where enabled = true and revoked_at is null;

alter table public.telematics_driver_bindings enable row level security;

revoke all on table public.telematics_driver_bindings from public, anon, authenticated;
grant all on table public.telematics_driver_bindings to service_role;

comment on table public.telematics_driver_bindings is
  'Maps one provider-native driver and vehicle identity pair to canonical XDrive driver, vehicle and company identities for signed telematics ingestion. Direct client access is fail-closed.';
comment on column public.telematics_driver_bindings.external_vehicle_id is
  'Provider vehicle identifier bound to exactly one canonical XDrive vehicle within the provider namespace.';
comment on column public.telematics_driver_bindings.vehicle_id is
  'Canonical active XDrive vehicle that the provider vehicle identity must resolve to.';
comment on column public.telematics_driver_bindings.revoked_at is
  'When set, the provider identity binding is no longer authorised for location ingestion.';