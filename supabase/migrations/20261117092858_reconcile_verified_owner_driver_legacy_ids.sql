-- ONE CANONICAL PUBLIC XD ID FOR VERIFIED OWNER DRIVERS.
-- Keep legal invoice/POD snapshots immutable. Old public IDs become restricted,
-- read-only aliases for historical lookup, never active commercial identities.
-- Unverified invitations, unbound workspaces and historical orphans are
-- deliberately not silently reparented to another principal.

begin;
set local lock_timeout = '8s';
set local statement_timeout = '60s';

-- Briefly block new signups and member-ID writes while both uniqueness
-- namespaces are reconciled. All DDL and DML roll back together on failure.
lock table public.profiles, public.companies in access exclusive mode;

create temporary table xdrive_verified_owner_id_reconciliation
on commit drop
as
select
  p.user_id as principal_user_id,
  c.id as principal_company_id,
  p.xd_id as previous_profile_xd_id,
  c.xd_id as previous_company_xd_id,
  case
    when exists (
       select 1 from public.invoices i
        where i.supplier_company_id=c.id or i.buyer_company_id=c.id
    ) or exists (
       select 1 from public.jobs j
        where j.assigned_company_id=c.id
           or j.awarded_carrier_company_id=c.id
           or j.posted_by_company_id=c.id
           or j.company_id=c.id
    ) then c.xd_id
    else p.xd_id
  end as canonical_xd_id
from public.platform_identity_registry registry
join public.profiles p on p.user_id=registry.user_id
join public.companies c on c.id=registry.company_id
  and c.created_by=p.user_id
  and c.company_type in ('owner_driver','sole_trader')
join public.drivers d on d.user_id=p.user_id
  and d.company_id=c.id
  and d.driver_type='owner_driver'
where registry.identity_mode='owner_driver'
  and registry.status='active'
  and registry.verified_at is not null
  and c.status::text='active'
  and p.xd_id is distinct from c.xd_id;

-- This automatic migration may only affect uniquely verified bindings.
do $guard$
begin
  if exists (
    select 1 from xdrive_verified_owner_id_reconciliation x
    group by x.principal_user_id having count(*)>1
  ) or exists (
    select 1 from xdrive_verified_owner_id_reconciliation x
    group by x.principal_company_id having count(*)>1
  ) then
    raise exception 'Ambiguous Owner Driver: more than one verified workspace is assigned.'
      using errcode='23514';
  end if;

  if exists (
    select 1 from xdrive_verified_owner_id_reconciliation x
    where x.canonical_xd_id is null
       or x.canonical_xd_id !~ '^XD-[0-9]{6,}$'
       or exists (
          select 1 from public.companies c
          where c.xd_id=x.canonical_xd_id
            and c.id<>x.principal_company_id
       )
       or exists (
          select 1 from public.profiles p
          where p.xd_id=x.canonical_xd_id
            and p.user_id<>x.principal_user_id
       )
  ) then
    raise exception 'Canonical public ID collision; no identities were changed.'
      using errcode='23505';
  end if;

  if exists (
    select 1 from xdrive_verified_owner_id_reconciliation x
    join public.xd_public_id_aliases a on
      a.legacy_xd_id = case
        when x.canonical_xd_id=x.previous_company_xd_id then x.previous_profile_xd_id
        else x.previous_company_xd_id end
    where a.canonical_xd_id<>x.canonical_xd_id
  ) then
    raise exception 'Existing historical alias has another canonical owner.'
      using errcode='23505';
  end if;
end;
$guard$;

-- Persist a nonpublic historical mapping BEFORE changing any current number.
insert into public.xd_public_id_aliases (
  legacy_xd_id,canonical_xd_id,principal_user_id,principal_company_id,reason
)
select
  case when x.canonical_xd_id=x.previous_company_xd_id
       then x.previous_profile_xd_id else x.previous_company_xd_id end,
  x.canonical_xd_id,x.principal_user_id,x.principal_company_id,
  case when x.canonical_xd_id=x.previous_company_xd_id
       then 'verified_owner_driver_preserve_commercial_history'
       else 'verified_owner_driver_preserve_original_member_id' end
from xdrive_verified_owner_id_reconciliation x
on conflict (legacy_xd_id) do nothing;

-- These are normally permanently immutable. This is the ONLY controlled
-- backfill: four known triggers are disabled within the same locked transaction
-- and restored (including their original ALWAYS status) before commit.
alter table public.profiles disable trigger trg_profiles_assign_xd_id;
alter table public.profiles disable trigger trg_profiles_xd_id_immutable;
alter table public.companies disable trigger trg_companies_assign_xd_id;
alter table public.companies disable trigger trg_companies_xd_id_immutable;

update public.profiles p
set xd_id=x.canonical_xd_id
from xdrive_verified_owner_id_reconciliation x
where p.user_id=x.principal_user_id
  and p.xd_id is distinct from x.canonical_xd_id;

update public.companies c
set xd_id=x.canonical_xd_id
from xdrive_verified_owner_id_reconciliation x
where c.id=x.principal_company_id
  and c.xd_id is distinct from x.canonical_xd_id;

alter table public.profiles enable trigger trg_profiles_assign_xd_id;
alter table public.profiles enable always trigger trg_profiles_xd_id_immutable;
alter table public.companies enable trigger trg_companies_assign_xd_id;
alter table public.companies enable always trigger trg_companies_xd_id_immutable;

-- Abort migration if any verified Owner Driver still has two active IDs,
-- including records without an original mismatch.
do $verify$
begin
  if exists (
    select 1
      from public.platform_identity_registry registry
      join public.profiles p on p.user_id=registry.user_id
      join public.companies c on c.id=registry.company_id
      join public.drivers d on d.user_id=p.user_id and d.company_id=c.id
    where registry.identity_mode='owner_driver'
      and registry.status='active'
      and registry.verified_at is not null
      and c.created_by=p.user_id
      and c.company_type in ('owner_driver','sole_trader')
      and d.driver_type='owner_driver'
      and p.xd_id is distinct from c.xd_id
  ) then
    raise exception 'Verified owner-driver public identities remain inconsistent.'
      using errcode='23514';
  end if;

  if exists (
    select 1 from xdrive_verified_owner_id_reconciliation x
    left join public.xd_public_id_aliases a on
      a.legacy_xd_id=case
        when x.canonical_xd_id=x.previous_company_xd_id
        then x.previous_profile_xd_id else x.previous_company_xd_id end
    where a.canonical_xd_id is distinct from x.canonical_xd_id
  ) then
    raise exception 'Historical ID cannot be resolved to its canonical owner.'
      using errcode='23514';
  end if;
end;
$verify$;

-- Future registry activation is also fail-closed. Driver credentials stay
-- individual, but an approved Owner Driver's public member ID and its personal
-- commercial workspace ID must agree.
create or replace function public.require_owner_driver_single_public_id()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_profile_xd_id text;
  v_company_xd_id text;
begin
  if new.identity_mode='owner_driver' and new.status='active' then
    select p.xd_id into v_profile_xd_id from public.profiles p
     where p.user_id=new.user_id;
    select c.xd_id into v_company_xd_id from public.companies c
     where c.id=new.company_id and c.created_by=new.user_id
       and c.company_type in ('owner_driver','sole_trader');
    if v_profile_xd_id is null or v_company_xd_id is null
       or v_profile_xd_id is distinct from v_company_xd_id then
      raise exception 'Owner Driver must have one verified public ID shared with the personal workspace.'
        using errcode='23514';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_owner_driver_single_public_id on public.platform_identity_registry;
create trigger trg_owner_driver_single_public_id
before insert or update of identity_mode, status, company_id, user_id
on public.platform_identity_registry
for each row execute function public.require_owner_driver_single_public_id();

comment on function public.require_owner_driver_single_public_id() is
'Prevents activation of an Owner Driver with two independent public XD IDs. Company-employed drivers operate under the employing carrier ID.';

commit;
