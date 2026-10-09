begin;

alter table public.jobs
  add column if not exists load_type text not null default 'on_demand',
  add column if not exists recurrence_rule jsonb,
  add column if not exists hire_end_datetime timestamptz;

alter table public.jobs
  drop constraint if exists jobs_load_type_check;

alter table public.jobs
  add constraint jobs_load_type_check
  check (load_type in ('on_demand','regular_load','daily_hire'));

update public.jobs
set load_type = 'on_demand'
where load_type is null
   or load_type not in ('on_demand','regular_load','daily_hire');

comment on column public.jobs.load_type is
  'Canonical marketplace load category: on_demand, regular_load, or daily_hire.';
comment on column public.jobs.recurrence_rule is
  'Optional recurrence metadata for regular_load jobs.';
comment on column public.jobs.hire_end_datetime is
  'Optional hire end timestamp for daily_hire jobs.';

notify pgrst, 'reload schema';

commit;
