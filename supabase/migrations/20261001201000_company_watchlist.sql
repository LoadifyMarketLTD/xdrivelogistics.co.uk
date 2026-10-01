-- CX-style company watchlist used by the Owner Driver dashboard and Directory.
create table if not exists public.company_watchlist (
  id uuid primary key default gen_random_uuid(),
  owner_company_id uuid not null references public.companies(id) on delete cascade,
  target_company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint company_watchlist_owner_target_unique unique(owner_company_id,target_company_id),
  constraint company_watchlist_not_self check(owner_company_id <> target_company_id)
);

create index if not exists company_watchlist_owner_company_idx
  on public.company_watchlist(owner_company_id,created_at desc);

alter table public.company_watchlist enable row level security;
revoke all on table public.company_watchlist from anon, authenticated;
grant select, insert, delete on table public.company_watchlist to service_role;
