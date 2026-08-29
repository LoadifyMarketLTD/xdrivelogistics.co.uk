-- Provider-neutral telematics provenance for driver location samples.
-- Existing driver/mobile writes remain valid through the driver_app default.

alter table public.driver_locations
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists source text not null default 'driver_app',
  add column if not exists source_provider text,
  add column if not exists source_event_id text;

alter table public.driver_locations
  drop constraint if exists driver_locations_source_check,
  drop constraint if exists driver_locations_telematics_provenance_check;

alter table public.driver_locations
  add constraint driver_locations_source_check
    check (source in ('driver_app', 'telematics')),
  add constraint driver_locations_telematics_provenance_check
    check (
      source <> 'telematics'
      or (
        source_provider is not null
        and length(trim(source_provider)) between 2 and 64
        and source_event_id is not null
        and length(trim(source_event_id)) between 1 and 160
        and vehicle_id is not null
        and company_id is not null
        and job_id is not null
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