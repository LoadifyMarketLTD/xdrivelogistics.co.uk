-- XDrive Marketplace pre-award privacy guard.
--
-- Marketplace clients receive quote-safe data from authenticated server APIs.
-- Exact addresses, site contacts, private execution notes and booking references
-- remain on public.jobs and therefore must not be readable directly by a
-- competing authenticated member before award/allocation.
--
-- This RESTRICTIVE SELECT policy combines with the existing permissive jobs
-- policies. Service-role server APIs continue to bypass RLS and project the
-- sanitised Marketplace DTO.

begin;

alter table public.jobs enable row level security;

drop policy if exists jobs_preaward_marketplace_privacy_guard on public.jobs;

create policy jobs_preaward_marketplace_privacy_guard
on public.jobs
as restrictive
for select
to authenticated
using (
  -- Non-Marketplace rows and awarded work continue through the existing jobs
  -- policy matrix unchanged.
  not (
    lower(coalesce(status::text, '')) = 'posted'
    and awarded_carrier_company_id is null
    and (
      exchange_posted_at is not null
      or lower(coalesce(exchange_visibility::text, '')) in ('exchange', 'direct')
    )
  )

  -- The company that owns/posts the transport request retains its full record.
  or exists (
    select 1
    from public.company_memberships cm
    where cm.user_id = auth.uid()
      and cm.company_id = jobs.company_id
      and lower(coalesce(cm.status::text, '')) = 'active'
  )

  -- Preserve Platform Owner administration. Application platform-owner users
  -- are historically represented by `owner`, with explicit legacy labels kept
  -- for compatibility.
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.role::text, '')) in (
        'owner',
        'super_admin',
        'platform_admin',
        'platform_owner'
      )
  )
);

comment on policy jobs_preaward_marketplace_privacy_guard on public.jobs is
  'Pre-award Marketplace job rows are readable in full only by the posting company or Platform Owner; competing members consume the quote-safe server projection.';

commit;
