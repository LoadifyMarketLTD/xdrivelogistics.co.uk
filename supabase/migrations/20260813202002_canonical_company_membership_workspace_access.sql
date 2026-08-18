create table if not exists public.company_membership_workspace_access (
  company_membership_id uuid not null references public.company_memberships(id) on delete cascade,
  workspace_key text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid null references auth.users(id),
  reason text null,
  primary key (company_membership_id, workspace_key)
);

create index if not exists idx_company_membership_workspace_access_workspace
  on public.company_membership_workspace_access(workspace_key);

alter table public.company_membership_workspace_access enable row level security;
