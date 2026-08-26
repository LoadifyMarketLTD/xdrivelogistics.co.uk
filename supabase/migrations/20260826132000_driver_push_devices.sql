create table if not exists public.driver_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  auth_session_id uuid not null,
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

create index if not exists driver_push_devices_session_idx
  on public.driver_push_devices (auth_session_id);

alter table public.driver_push_devices enable row level security;

revoke all on table public.driver_push_devices from anon, authenticated;
grant all on table public.driver_push_devices to service_role;

comment on table public.driver_push_devices is
  'Server-only registry of native driver push delivery endpoints. Native clients register through authenticated XDrive APIs; direct anon/authenticated table access is revoked.';
comment on column public.driver_push_devices.fcm_token is
  'Provider delivery token. Treat as sensitive routing data and expose only to trusted server-side delivery code.';
comment on column public.driver_push_devices.auth_session_id is
  'Supabase JWT session_id captured only after server validation. Delivery is eligible only while the matching auth.sessions row remains active and unexpired.';

create or replace function public.active_driver_push_devices_for_user(p_user_id uuid)
returns table (
  device_id uuid,
  installation_id uuid,
  fcm_token text,
  platform text,
  app_package text
)
language sql
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    d.id,
    d.installation_id,
    d.fcm_token,
    d.platform,
    d.app_package
  from public.driver_push_devices d
  join auth.sessions s
    on s.id = d.auth_session_id
   and s.user_id = d.user_id
  where d.user_id = p_user_id
    and d.enabled = true
    and d.platform = 'android'
    and d.app_package = 'co.uk.xdrivelogistics.driver'
    and (s.not_after is null or s.not_after > now())
  order by d.last_seen_at desc, d.id;
$$;

revoke all on function public.active_driver_push_devices_for_user(uuid) from public, anon, authenticated;
grant execute on function public.active_driver_push_devices_for_user(uuid) to service_role;
