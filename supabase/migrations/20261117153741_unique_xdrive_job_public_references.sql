-- Canonical immutable XDrive job reference. Existing unique XDL-8 refs are retained.
-- On historical prefix collisions, one XDL-8 remains canonical and other rows
-- receive their unambiguous XDL-32 reference. Both remain searchable as aliases.
-- Do not overwrite jobs, posted customer refs, Collection/POD snapshots or invoices.
create table if not exists public.xdrive_job_references (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  public_reference text not null unique,
  created_at timestamptz not null default now(),
  constraint xdrive_job_public_reference_format check
    (public_reference ~ '^XDL-[0-9A-F]{8}([0-9A-F]{24})?$')
);
alter table public.xdrive_job_references enable row level security;
revoke all on table public.xdrive_job_references from public, anon, authenticated;
grant select on table public.xdrive_job_references to service_role;

-- Materialise existing references without invoking UPDATE triggers on jobs.
-- For a collision, the earliest created historical record retains the short ref.
with ranked as (
  select j.id, row_number() over (
    partition by upper(left(j.id::text, 8))
    order by j.created_at nulls last, j.id
  ) as prefix_rank
  from public.jobs j
)
insert into public.xdrive_job_references (job_id, public_reference)
select ranked.id,
  case when ranked.prefix_rank = 1
    then 'XDL-' || upper(left(ranked.id::text, 8))
    else 'XDL-' || upper(replace(ranked.id::text, '-', ''))
  end
from ranked
on conflict (job_id) do nothing;

do $assert$
begin
  if (select count(*) from public.xdrive_job_references)
     <> (select count(*) from public.jobs) then
    raise exception 'Canonical job reference registry incomplete: refuse migration';
  end if;
end;
$assert$;

-- Serialize inserts on the short candidate: concurrent jobs cannot get
-- the same public reference. Full UUID disambiguation is deterministic.
create or replace function public.assign_xdrive_job_public_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $assign$
declare
  v_short text;
  v_ref text;
begin
  if new.id is null then
    raise exception 'Job must have a UUID before assigning XDrive reference';
  end if;
  v_short := 'XDL-' || upper(left(new.id::text, 8));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_short, 20261117));
  if exists (select 1 from public.xdrive_job_references r where r.public_reference = v_short) then
    v_ref := 'XDL-' || upper(replace(new.id::text, '-', ''));
  else
    v_ref := v_short;
  end if;
  insert into public.xdrive_job_references(job_id, public_reference)
    values (new.id, v_ref);
  return new;
end;
$assign$;
revoke all on function public.assign_xdrive_job_public_reference()
  from public, anon, authenticated;
drop trigger if exists trg_assign_xdrive_job_public_reference on public.jobs;
create trigger trg_assign_xdrive_job_public_reference
after insert on public.jobs
for each row execute function public.assign_xdrive_job_public_reference();

-- Historical reference immutability: no API can silently change a published ID.
create or replace function public.guard_xdrive_job_public_reference_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $guard$
begin
  if new.job_id is distinct from old.job_id
    or new.public_reference is distinct from old.public_reference then
    raise exception 'Official XDrive job reference is immutable';
  end if;
  return new;
end;
$guard$;
drop trigger if exists trg_xdrive_job_public_reference_immutable
  on public.xdrive_job_references;
create trigger trg_xdrive_job_public_reference_immutable
before update on public.xdrive_job_references
for each row execute function public.guard_xdrive_job_public_reference_immutable();

-- Expose the new service-role-only FK relationship to server-side PostgREST embeds.
notify pgrst, 'reload schema';
