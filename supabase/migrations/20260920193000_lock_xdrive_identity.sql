create or replace function public.prevent_xdrive_identity_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.xd_id is not null and new.xd_id is distinct from old.xd_id then
    raise exception 'XDrive identity is immutable once assigned.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_profiles_xd_id_immutable on public.profiles;
create trigger trg_profiles_xd_id_immutable
before update of xd_id on public.profiles
for each row
execute function public.prevent_xdrive_identity_change();
alter table public.profiles enable always trigger trg_profiles_xd_id_immutable;

drop trigger if exists trg_companies_xd_id_immutable on public.companies;
create trigger trg_companies_xd_id_immutable
before update of xd_id on public.companies
for each row
execute function public.prevent_xdrive_identity_change();
alter table public.companies enable always trigger trg_companies_xd_id_immutable;

comment on column public.profiles.xd_id is
'Immutable XDrive member/user identifier assigned at registration. Never use Companies House/company_number as Member ID.';

comment on column public.companies.xd_id is
'Immutable XDrive company identifier once assigned. Legal company_number/CRN is a separate field and must never be presented as Member ID.';
