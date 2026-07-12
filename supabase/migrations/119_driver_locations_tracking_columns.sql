alter table public.driver_locations
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists heading double precision,
  add column if not exists speed_mph double precision,
  add column if not exists updated_at timestamptz not null default now();

update public.driver_locations dl
set company_id = d.company_id
from public.drivers d
where dl.driver_id = d.id
  and dl.company_id is null;

create index if not exists idx_driver_locations_company_recorded
  on public.driver_locations(company_id, recorded_at desc);

create index if not exists idx_driver_locations_driver_recorded
  on public.driver_locations(driver_id, recorded_at desc);
