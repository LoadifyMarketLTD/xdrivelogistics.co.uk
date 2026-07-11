-- ─── 131: driver_device_tokens ───────────────────────────────────────────────
--
-- Multi-device push token registry.
-- Each physical device gets its own row keyed by (driver_id, device_id).
-- Stale/deregistered tokens are marked active = false rather than deleted.

create table if not exists driver_device_tokens (
  id              uuid        primary key default gen_random_uuid(),
  driver_id       uuid        not null references drivers(id)  on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  device_id       text        not null,
  expo_push_token text        not null,
  platform        text,
  app_version     text,
  active          boolean     not null default true,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- one token per (driver, device) pair
  constraint driver_device_tokens_driver_device_unique
    unique (driver_id, device_id)
);

create index if not exists driver_device_tokens_driver_id_idx
  on driver_device_tokens(driver_id);

create index if not exists driver_device_tokens_active_idx
  on driver_device_tokens(active)
  where active = true;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table driver_device_tokens enable row level security;

-- A driver can see only their own device tokens
create policy "driver_device_tokens_driver_select"
  on driver_device_tokens for select
  using (
    driver_id in (
      select id from drivers where user_id = auth.uid()
    )
  );

-- All inserts/updates are done server-side via service role only.
-- No client INSERT / UPDATE policies are granted.
