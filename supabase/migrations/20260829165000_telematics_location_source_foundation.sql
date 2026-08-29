-- Provider-neutral telematics provenance for driver location samples.
-- Existing driver/mobile writes remain valid through the driver_app default.

alter table public.driver_locations
  add column if not exists source text not null default 'driver_app',
  add column if not exists source_provider text,
  add column if not exists source_event_id text;

alter table public.driver_locations
  drop constraint if exists driver_locations_source_check;

alter table public.driver_locations
  add constraint driver_locations_source_check
  check (source in ('driver_app', 'telematics'));

create index if not exists idx_driver_locations_source_recorded
  on public.driver_locations(source, source_provider, recorded_at desc);

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
