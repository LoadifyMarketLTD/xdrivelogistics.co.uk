begin;

create index if not exists idx_jobs_assigned_driver_id
  on public.jobs (assigned_driver_id);

create index if not exists idx_driver_documents_driver_id
  on public.driver_documents (driver_id);

create index if not exists idx_driver_job_search_preferences_job_id
  on public.driver_job_search_preferences (job_id);

commit;
