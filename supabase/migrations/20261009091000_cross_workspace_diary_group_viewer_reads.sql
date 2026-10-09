begin;

drop policy if exists diary_groups_select_job_viewer on public.diary_groups;
create policy diary_groups_select_job_viewer
on public.diary_groups
for select
to authenticated
using (public.can_company_job_viewer(company_id));

drop policy if exists diary_group_jobs_select_job_viewer on public.diary_group_jobs;
create policy diary_group_jobs_select_job_viewer
on public.diary_group_jobs
for select
to authenticated
using (public.can_company_job_viewer(company_id));

notify pgrst, 'reload schema';

commit;
