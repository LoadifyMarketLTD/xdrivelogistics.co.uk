create table if not exists public.company_customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  email text null,
  phone text null,
  address text null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_customers_company_id_idx
  on public.company_customers(company_id);

create unique index if not exists company_customers_company_name_unique
  on public.company_customers(company_id, lower(btrim(name)));

alter table public.company_customers enable row level security;

drop policy if exists company_customers_select_member on public.company_customers;
create policy company_customers_select_member
on public.company_customers for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists company_customers_insert_member on public.company_customers;
create policy company_customers_insert_member
on public.company_customers for insert
to authenticated
with check (public.is_company_member(company_id) and (created_by is null or created_by = auth.uid()));

drop policy if exists company_customers_update_member on public.company_customers;
create policy company_customers_update_member
on public.company_customers for update
to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

drop policy if exists company_customers_delete_member on public.company_customers;
create policy company_customers_delete_member
on public.company_customers for delete
to authenticated
using (public.is_company_member(company_id));
