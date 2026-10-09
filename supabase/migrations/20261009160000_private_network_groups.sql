begin;

create table if not exists public.network_groups (
  id uuid primary key default gen_random_uuid(),
  owner_company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  allow_load_visibility boolean not null default true,
  allow_availability_visibility boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint network_groups_owner_name_unique unique(owner_company_id, name)
);

create table if not exists public.network_group_members (
  group_id uuid not null references public.network_groups(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  added_by uuid not null,
  created_at timestamptz not null default now(),
  primary key(group_id, company_id)
);

create index if not exists network_groups_owner_company_idx
  on public.network_groups(owner_company_id, updated_at desc);
create index if not exists network_group_members_company_idx
  on public.network_group_members(company_id, group_id);

alter table public.network_groups enable row level security;
alter table public.network_group_members enable row level security;
revoke all on table public.network_groups, public.network_group_members from anon, authenticated;
grant select, insert, update, delete on table public.network_groups, public.network_group_members to service_role;

alter table public.jobs
  add column if not exists visibility_group_id uuid references public.network_groups(id) on delete set null;

alter table public.jobs drop constraint if exists jobs_exchange_visibility_check;
alter table public.jobs
  add constraint jobs_exchange_visibility_check
  check (exchange_visibility in ('private','exchange','direct','private_group'));

create index if not exists jobs_visibility_group_idx
  on public.jobs(visibility_group_id)
  where visibility_group_id is not null;

notify pgrst, 'reload schema';
commit;
