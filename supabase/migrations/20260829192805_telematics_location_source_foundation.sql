-- Provider-neutral telematics provenance for driver location samples.
-- Existing driver/mobile writes remain valid through the driver_app default.

alter table public.driver_locations
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists source text not null default 'driver_app',
  add column if not exists source_provider text,
  add column if not exists source_event_id text;

-- Hosted driver_locations still requires geography location NOT NULL, while the
-- current Driver and Telematics routes publish numeric lat/lng. Keep both
-- representations canonical at the database boundary so either client shape is
-- safe and downstream spatial matching always has a geography value.
create or replace function public.fn_sync_driver_location_coordinates()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.location is distinct from old.location
     and new.lat is not distinct from old.lat
     and new.lng is not distinct from old.lng then
    -- A legacy/geography writer changed only location. Preserve that update and
    -- derive the numeric representation from the new geography value.
    if new.location is not null then
      new.lat := st_y(new.location::geometry);
      new.lng := st_x(new.location::geometry);
    end if;
  elsif new.lat is not null and new.lng is not null then
    -- Current Driver/Telematics writers use numeric coordinates. They are the
    -- source of truth when either numeric coordinate is supplied/changed.
    new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  elsif new.location is not null then
    new.lat := st_y(new.location::geometry);
    new.lng := st_x(new.location::geometry);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_driver_location_coordinates on public.driver_locations;
create trigger trg_sync_driver_location_coordinates
  before insert or update of location, lat, lng on public.driver_locations
  for each row
  execute function public.fn_sync_driver_location_coordinates();

alter table public.driver_locations
  drop constraint if exists driver_locations_source_check,
  drop constraint if exists driver_locations_telematics_provenance_check;

alter table public.driver_locations
  add constraint driver_locations_source_check
    check (source in ('driver_app', 'telematics')),
  add constraint driver_locations_telematics_provenance_check
    check (
      (
        source = 'driver_app'
        and source_provider is null
        and source_event_id is null
      )
      or (
        source = 'telematics'
        and source_provider is not null
        and length(trim(source_provider)) between 2 and 64
        and source_event_id is not null
        and length(trim(source_event_id)) between 1 and 160
        and vehicle_id is not null
        and company_id is not null
        and job_id is not null
      )
    );

-- Direct authenticated location writes remain supported for the Driver app, but
-- provider provenance is reserved for the service-role integration route. This
-- prevents an authenticated Driver client from forging source='telematics'.
drop policy if exists driver_locations_insert_self on public.driver_locations;
create policy driver_locations_insert_self
  on public.driver_locations
  for insert
  to authenticated
  with check (
    source = 'driver_app'
    and source_provider is null
    and source_event_id is null
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_locations.driver_id
        and d.user_id = auth.uid()
    )
  );

drop policy if exists driver_locations_update_self on public.driver_locations;
create policy driver_locations_update_self
  on public.driver_locations
  for update
  to authenticated
  using (
    source = 'driver_app'
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_locations.driver_id
        and d.user_id = auth.uid()
    )
  )
  with check (
    source = 'driver_app'
    and source_provider is null
    and source_event_id is null
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_locations.driver_id
        and d.user_id = auth.uid()
    )
  );

create index if not exists idx_driver_locations_source_recorded
  on public.driver_locations(source, source_provider, recorded_at desc);
create index if not exists idx_driver_locations_vehicle_recorded
  on public.driver_locations(vehicle_id, recorded_at desc)
  where vehicle_id is not null;
create index if not exists idx_driver_locations_job_recorded
  on public.driver_locations(job_id, recorded_at desc)
  where job_id is not null;

create unique index if not exists uq_driver_locations_telematics_event
  on public.driver_locations(source_provider, source_event_id)
  where source = 'telematics'
    and source_provider is not null
    and source_event_id is not null;

comment on column public.driver_locations.source is
  'Location producer. driver_app is the native XDrive driver client; telematics is a signed server-to-server provider feed.';
comment on column public.driver_locations.source_provider is
  'Provider slug for telematics-originated samples; null for XDrive driver-app samples.';
comment on column public.driver_locations.source_event_id is
  'Provider event identifier used to make telematics ingestion idempotent.';
comment on column public.driver_locations.vehicle_id is
  'Canonical XDrive vehicle associated with the location sample when known; required for telematics-originated samples.';
comment on column public.driver_locations.company_id is
  'Canonical XDrive company context associated with the sample; required for telematics-originated samples.';
comment on column public.driver_locations.job_id is
  'Active XDrive job associated with the location sample; required for telematics-originated samples.';