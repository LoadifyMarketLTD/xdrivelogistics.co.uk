create table if not exists public.driver_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  installation_id uuid not null,
  platform text not null default 'android' check (platform in ('android')),
  app_package text not null default 'co.uk.xdrivelogistics.driver',
  fcm_token text not null,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installation_id),
  unique (fcm_token)
);

create index if not exists driver_push_devices_user_enabled_idx
  on public.driver_push_devices (user_id, enabled)
  where enabled = true;

create index if not exists driver_push_devices_driver_enabled_idx
  on public.driver_push_devices (driver_id, enabled)
  where enabled = true;

alter table public.driver_push_devices enable row level security;

revoke all on table public.driver_push_devices from anon, authenticated;
grant all on table public.driver_push_devices to service_role;

comment on table public.driver_push_devices is
  'Server-only registry of native driver push delivery endpoints. Native clients register through authenticated XDrive APIs; direct anon/authenticated table access is revoked.';
comment on column public.driver_push_devices.fcm_token is
  'Provider delivery token. Treat as sensitive routing data and expose only to trusted server-side delivery code.';
