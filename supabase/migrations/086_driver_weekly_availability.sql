-- Migration 086: Driver Weekly Availability Slots
-- Adds driver_availability_slots table for recurring weekly schedule (Mon–Sun, AM/PM/Evening)

create table if not exists public.driver_availability_slots (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.drivers(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6), -- 0=Monday, 6=Sunday
  slot          text not null check (slot in ('AM', 'PM', 'EVENING')),
  available     boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique (driver_id, day_of_week, slot)
);

-- Index for fast per-driver lookups
create index if not exists driver_availability_slots_driver_idx
  on public.driver_availability_slots (driver_id);

-- RLS
alter table public.driver_availability_slots enable row level security;

-- Drivers can read/write their own slots
create policy "driver_availability_slots_select_own"
  on public.driver_availability_slots for select
  using (
    exists (
      select 1 from public.drivers d
      where d.id = driver_availability_slots.driver_id
        and d.user_id = auth.uid()
    )
  );

create policy "driver_availability_slots_insert_own"
  on public.driver_availability_slots for insert
  with check (
    exists (
      select 1 from public.drivers d
      where d.id = driver_availability_slots.driver_id
        and d.user_id = auth.uid()
    )
  );

create policy "driver_availability_slots_update_own"
  on public.driver_availability_slots for update
  using (
    exists (
      select 1 from public.drivers d
      where d.id = driver_availability_slots.driver_id
        and d.user_id = auth.uid()
    )
  );

-- Company members with an administrative company_role can read driver
-- availability in their company. company_memberships.role_in_company is the
-- public.company_role enum, whose canonical values are owner, admin,
-- dispatcher and viewer. Profile/auth aliases such as admin_staff and
-- company_admin are intentionally excluded because they are not enum values.
create policy "driver_availability_slots_select_admin"
  on public.driver_availability_slots for select
  using (
    exists (
      select 1
      from public.drivers d
      join public.company_memberships cm
        on cm.company_id = d.company_id
      where d.id = driver_availability_slots.driver_id
        and cm.user_id = auth.uid()
        and cm.role_in_company in ('owner', 'admin', 'dispatcher')
        and cm.status = 'active'
    )
  );
