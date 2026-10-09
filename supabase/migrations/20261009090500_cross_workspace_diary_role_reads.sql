begin;

create or replace function public.can_company_job_viewer(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    join public.profiles p on p.user_id = cm.user_id
    join public.companies c on c.id = cm.company_id
    where cm.company_id = cid
      and cm.user_id = auth.uid()
      and cm.status::text = 'active'
      and cm.role_in_company::text in ('owner','admin','dispatcher','member','fleet_manager','finance','viewer')
      and coalesce(p.role, '') <> 'driver'
      and coalesce(p.status::text, '') = 'active'
      and c.status::text = 'active'
  );
$$;

revoke all on function public.can_company_job_viewer(uuid) from public, anon;
grant execute on function public.can_company_job_viewer(uuid) to authenticated, service_role;

drop policy if exists jobs_select_company_job_viewer on public.jobs;
create policy jobs_select_company_job_viewer
on public.jobs
for select
to authenticated
using (public.can_company_job_viewer(company_id));

drop policy if exists jobs_assigned_company_job_viewer on public.jobs;
create policy jobs_assigned_company_job_viewer
on public.jobs
for select
to authenticated
using (
  assigned_company_id is not null
  and public.can_company_job_viewer(assigned_company_id)
);

drop policy if exists reviews_select_company_diary_viewer on public.reviews;
create policy reviews_select_company_diary_viewer
on public.reviews
for select
to authenticated
using (
  (company_id is not null and public.can_company_job_viewer(company_id))
  or (reviewer_company_id is not null and public.can_company_job_viewer(reviewer_company_id))
);

drop policy if exists diary_groups_select_fleet_manager on public.diary_groups;
create policy diary_groups_select_fleet_manager
on public.diary_groups
for select
to authenticated
using (
  public.active_company_membership_role(company_id, auth.uid()) = 'fleet_manager'
);

drop policy if exists diary_group_jobs_select_fleet_manager on public.diary_group_jobs;
create policy diary_group_jobs_select_fleet_manager
on public.diary_group_jobs
for select
to authenticated
using (
  public.active_company_membership_role(company_id, auth.uid()) = 'fleet_manager'
);

notify pgrst, 'reload schema';

commit;
