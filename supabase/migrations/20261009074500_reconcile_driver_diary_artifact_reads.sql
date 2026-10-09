begin;

drop policy if exists job_tracking_select_assigned_driver on public.job_tracking_events;
create policy job_tracking_select_assigned_driver
on public.job_tracking_events
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.drivers d on d.id = j.assigned_driver_id
    where j.id = job_tracking_events.job_id
      and d.user_id = auth.uid()
  )
);

drop policy if exists job_notes_select_assigned_driver on public.job_notes;
create policy job_notes_select_assigned_driver
on public.job_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.drivers d on d.id = j.assigned_driver_id
    where j.id = job_notes.job_id
      and d.user_id = auth.uid()
  )
);

drop policy if exists job_documents_select_assigned_driver on public.job_documents;
create policy job_documents_select_assigned_driver
on public.job_documents
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.drivers d on d.id = j.assigned_driver_id
    where j.id = job_documents.job_id
      and d.user_id = auth.uid()
  )
);

grant select on public.job_tracking_events, public.job_notes, public.job_documents to authenticated;

notify pgrst, 'reload schema';

commit;
