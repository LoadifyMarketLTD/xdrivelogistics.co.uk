-- Canonical XDrive public identity: a personal Owner Driver/sole trader has ONE
-- public commercial XD ID across the user profile and personal workspace.
-- A company driver works commercially under their employer's company XD ID.
-- Do not rewrite already-issued IDs or historical invoices in this migration.

-- Private legacy lookup; never grant clients access to identity reconciliation.
create table if not exists public.xd_public_id_aliases (
  legacy_xd_id text primary key check (legacy_xd_id ~ '^XD-[0-9]{6,}$'),
  canonical_xd_id text not null check (canonical_xd_id ~ '^XD-[0-9]{6,}$'),
  principal_user_id uuid null,
  principal_company_id uuid null,
  reason text not null,
  reconciled_at timestamptz not null default now(),
  constraint xd_public_id_aliases_distinct check (legacy_xd_id <> canonical_xd_id)
);
create index if not exists xd_public_id_aliases_canonical_idx
  on public.xd_public_id_aliases(canonical_xd_id);
alter table public.xd_public_id_aliases enable row level security;
revoke all on public.xd_public_id_aliases from public, anon, authenticated;
grant select on public.xd_public_id_aliases to service_role;

create or replace function public.resolve_canonical_xd_public_id(p_reference text)
returns text
language sql
stable
security invoker
set search_path = pg_catalog, public
as $function$
  select coalesce(
    (select a.canonical_xd_id
       from public.xd_public_id_aliases a
      where a.legacy_xd_id = upper(btrim(p_reference))),
    upper(btrim(p_reference))
  );
$function$;
revoke all on function public.resolve_canonical_xd_public_id(text) from public, anon, authenticated;
grant execute on function public.resolve_canonical_xd_public_id(text) to service_role;

-- A personal workspace must reuse its Owner Driver's immutable user public ID.
-- Commercial companies/fleets/brokers/customers continue to receive their OWN
-- public IDs: these are separate legal/contractual actors from a company user.
create or replace function public.assign_xd_company_id()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_user_xd_id text;
begin
  if TG_OP = 'INSERT' then
    if new.company_type in ('owner_driver', 'sole_trader') then
      if new.created_by is null then
        raise exception 'Personal XDrive workspace requires a verified creator.'
          using errcode = '23514';
      end if;

      -- Serialize attempts by the same creator; existence checks alone race.
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('xdrive-personal-company:' || new.created_by::text, 0)
      );

      select p.xd_id into v_user_xd_id
        from public.profiles p
       where p.user_id = new.created_by;

      if nullif(btrim(coalesce(v_user_xd_id, '')), '') is null then
        raise exception 'Personal XDrive workspace requires an existing public member ID.'
          using errcode = '23514';
      end if;

      -- Existing personal workspace must be reused, never duplicated.
      if exists (
        select 1 from public.companies existing
         where existing.created_by = new.created_by
           and existing.company_type in ('owner_driver', 'sole_trader')
      ) then
        raise exception 'An Owner Driver already has a personal XDrive workspace; reuse it.'
          using errcode = '23505';
      end if;
      -- Protect against an unrelated company already using this XD ID.
      if exists (
        select 1 from public.companies existing
         where existing.xd_id = v_user_xd_id
      ) then
        raise exception 'XDrive member ID is already linked to a company.'
          using errcode = '23505';
      end if;

      new.xd_id := v_user_xd_id;
    else
      new.xd_id := public.generate_xd_public_id();
    end if;
  elsif new.xd_id is distinct from old.xd_id then
    raise exception 'XDrive public ID is immutable after assignment.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- Do not allow turning a legal company into a personal workspace (or back)
-- by changing a label while keeping an incompatible public ID.
create or replace function public.guard_personal_workspace_identity_type()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_was_personal boolean;
  v_is_personal boolean;
begin
  v_was_personal := coalesce(old.company_type in ('owner_driver', 'sole_trader'), false);
  v_is_personal := coalesce(new.company_type in ('owner_driver', 'sole_trader'), false);
  if v_was_personal is distinct from v_is_personal
     or (v_was_personal and new.created_by is distinct from old.created_by)
  then
    raise exception 'Personal workspace identity or owner change needs a verified identity reconciliation.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;
drop trigger if exists trg_guard_personal_workspace_identity_type on public.companies;
create trigger trg_guard_personal_workspace_identity_type
before update of company_type, created_by on public.companies
for each row
execute function public.guard_personal_workspace_identity_type();

comment on function public.assign_xd_company_id() is
'Assigns one shared public XD ID to an Owner Driver and personal workspace. Legal carrier/broker/customer companies retain separate commercial XD IDs.';
