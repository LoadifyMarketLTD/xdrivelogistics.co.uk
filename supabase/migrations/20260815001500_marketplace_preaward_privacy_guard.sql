-- XDrive Marketplace pre-award privacy boundary.
--
-- Business rule:
--   Marketplace members may receive a quote-safe projection through the
--   authenticated server API, but must not be able to SELECT the underlying
--   posted job row directly before award/allocation. Exact addresses, site
--   contacts, private execution instructions and references live on `jobs` and
--   therefore cannot be protected by hiding fields in React alone.
--
-- This is deliberately a RESTRICTIVE SELECT policy. Existing permissive job
-- policies continue to decide which non-marketplace rows a user may read; this
-- guard only adds an AND-boundary around pre-award marketplace rows. Service
-- role/server-side Marketplace APIs bypass RLS and return the sanitised DTO.

begin;

alter table public.jobs enable row level security;

drop policy if exists jobs_preaward_marketplace_privacy_guard on public.jobs;

create policy jobs_preaward_marketplace_privacy_guard
on public.jobs
as restrictive
for select
to authenticated
using (
  -- Normal owned/awarded/assigned/non-marketplace rows continue through the
  -- existing policy matrix.
  not (
    lower(coalesce(status::text, '')) = 'posted'
    and awarded_carrier_company_id is null
    and (
      exchange_posted_at is not null
      or lower(coalesce(exchange_visibility::text, '')) in ('exchange', 'direct')
    )
  )

  -- The company that owns the transport request may always read its own full
  -- booking record. Marketplace competitors may not.
  or exists (
    select 1
    from public.company_memberships cm
    where cm.user_id = auth.uid()
      and cm.company_id = jobs.company_id
      and lower(coalesce(cm.status::text, '')) = 'active'
  )

  -- Keep platform administration behaviour intact. The application maps the
  -- `owner` role to Platform Owner and historical deployments may also contain
  -- the explicit super/platform admin labels.
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) in ('owner', 'super_admin', 'platform_admin')
  )
);

comment on policy jobs_preaward_marketplace_privacy_guard on public.jobs is
  'Restrictive privacy guard: pre-award marketplace rows are readable in full only by the posting company or platform administration; competitors consume the quote-safe server projection.';

commit;
