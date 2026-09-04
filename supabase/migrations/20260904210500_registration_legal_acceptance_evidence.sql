-- Immutable registration and material re-acceptance legal evidence.
-- Preview-only migration until PR #499 is explicitly approved and merged.

begin;

create table if not exists public.registration_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  company_id uuid null references public.companies(id) on delete restrict,
  onboarding_application_id uuid null references public.onboarding_applications(id) on delete restrict,
  registration_role text not null check (registration_role in ('customer_shipper','transport_broker','owner_operator','fleet_operator')),
  legal_version text not null,
  agreements jsonb not null,
  acceptance_statement text not null,
  authority_statement text not null,
  role_statement text not null,
  privacy_statement text not null,
  privacy_version text not null,
  accepted_at timestamptz not null,
  source text not null default 'registration' check (source in ('registration', 'material_reacceptance')),
  user_agent text null,
  evidence_hash text not null,
  created_at timestamptz not null default now(),
  constraint registration_legal_acceptances_agreements_array check (jsonb_typeof(agreements) = 'array'),
  constraint registration_legal_acceptances_hash_format check (evidence_hash ~ '^[0-9a-f]{64}$'),
  constraint registration_legal_acceptances_unique_evidence unique (user_id, evidence_hash)
);

comment on table public.registration_legal_acceptances is
  'Append-only evidence of role-specific legal agreements accepted during registration and later material re-acceptance.';

create index if not exists registration_legal_acceptances_user_created_idx
  on public.registration_legal_acceptances (user_id, created_at desc);
create index if not exists registration_legal_acceptances_company_created_idx
  on public.registration_legal_acceptances (company_id, created_at desc)
  where company_id is not null;
create index if not exists registration_legal_acceptances_onboarding_idx
  on public.registration_legal_acceptances (onboarding_application_id)
  where onboarding_application_id is not null;

alter table public.registration_legal_acceptances enable row level security;

-- Evidence is written only by trusted server-side service-role code. No browser
-- role receives direct read/write rights; account UI reads must use a deliberately
-- scoped server route that authenticates the requesting user and filters by user_id.
revoke all on table public.registration_legal_acceptances from public, anon, authenticated;
grant select, insert on table public.registration_legal_acceptances to service_role;

create or replace function public.prevent_registration_legal_acceptance_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'registration_legal_acceptances is append-only';
end;
$$;

revoke all on function public.prevent_registration_legal_acceptance_mutation() from public, anon, authenticated;

drop trigger if exists registration_legal_acceptances_no_update on public.registration_legal_acceptances;
create trigger registration_legal_acceptances_no_update
before update on public.registration_legal_acceptances
for each row execute function public.prevent_registration_legal_acceptance_mutation();

drop trigger if exists registration_legal_acceptances_no_delete on public.registration_legal_acceptances;
create trigger registration_legal_acceptances_no_delete
before delete on public.registration_legal_acceptances
for each row execute function public.prevent_registration_legal_acceptance_mutation();

commit;

notify pgrst, 'reload schema';
