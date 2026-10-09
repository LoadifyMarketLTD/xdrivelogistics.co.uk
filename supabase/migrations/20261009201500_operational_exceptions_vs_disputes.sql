begin;

create table if not exists public.job_operational_exceptions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  reported_by uuid not null,
  category text not null,
  severity text not null default 'warning',
  status text not null default 'open',
  description text not null,
  occurred_at timestamptz not null default now(),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_operational_exceptions_category_check check (
    category in (
      'delay','breakdown','collection_failed','delivery_failed','damage',
      'access_issue','customer_unavailable','vehicle_issue','other'
    )
  ),
  constraint job_operational_exceptions_severity_check check (
    severity in ('info','warning','critical')
  ),
  constraint job_operational_exceptions_status_check check (
    status in ('open','monitoring','resolved')
  )
);

create index if not exists job_operational_exceptions_job_idx
  on public.job_operational_exceptions(job_id, created_at desc);
create index if not exists job_operational_exceptions_company_idx
  on public.job_operational_exceptions(company_id, status, created_at desc);

alter table public.job_operational_exceptions enable row level security;
revoke all on table public.job_operational_exceptions from anon, authenticated;
grant select, insert, update, delete on table public.job_operational_exceptions to service_role;

comment on table public.job_operational_exceptions is
  'Operational execution exceptions (delay, breakdown, failed collection/delivery, damage, access issues). These are deliberately separate from formal commercial job_disputes.';

notify pgrst, 'reload schema';
commit;
