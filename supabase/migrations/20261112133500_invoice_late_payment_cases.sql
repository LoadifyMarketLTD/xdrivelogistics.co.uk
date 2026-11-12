-- UK B2B statutory late-payment case register. No automatic charges or invoice mutation.
create table if not exists public.invoice_late_payment_cases (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  creditor_company_id uuid not null,
  debtor_company_id uuid,
  status text not null default 'draft' check (status in ('draft','under_review','approved','claimed','partially_recovered','recovered','waived','rejected')),
  original_debt_gbp numeric(14,2) not null check (original_debt_gbp > 0),
  interest_claim_gbp numeric(14,2) not null default 0 check (interest_claim_gbp >= 0),
  compensation_claim_gbp numeric(14,2) not null default 0 check (compensation_claim_gbp >= 0),
  recovery_cost_claim_gbp numeric(14,2) not null default 0 check (recovery_cost_claim_gbp >= 0),
  recovered_gbp numeric(14,2) not null default 0 check (recovered_gbp >= 0),
  rate_schedule jsonb not null default '[]'::jsonb,
  payment_schedule jsonb not null default '[]'::jsonb,
  assessment jsonb not null default '{}'::jsonb,
  review_notes text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint late_payment_recovery_limit check (recovered_gbp <= interest_claim_gbp + compensation_claim_gbp + recovery_cost_claim_gbp),
  constraint late_payment_approval_consistency check (status not in ('approved','claimed','partially_recovered','recovered') or (approved_by is not null and approved_at is not null)),
  constraint late_payment_case_unique unique (invoice_id)
);
create index if not exists invoice_late_payment_cases_creditor_idx on public.invoice_late_payment_cases (creditor_company_id,status);
alter table public.invoice_late_payment_cases enable row level security;
revoke all on public.invoice_late_payment_cases from anon, authenticated;
-- Writes are performed only through validated, company-scoped server endpoints.
create table if not exists public.invoice_late_payment_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.invoice_late_payment_cases(id) on delete restrict,
  event_type text not null check (event_type in ('created','reviewed','approved','claimed','recovery_recorded','waived','rejected','note')),
  actor_user_id uuid not null references auth.users(id),
  amount_gbp numeric(14,2) check (amount_gbp is null or amount_gbp >= 0),
  note text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists invoice_late_payment_events_case_idx on public.invoice_late_payment_events (case_id,created_at);
alter table public.invoice_late_payment_events enable row level security;
revoke all on public.invoice_late_payment_events from anon, authenticated;
-- Prevent rewriting or deleting financial audit entries, including service-role DML.
create or replace function public.reject_late_payment_audit_mutation() returns trigger language plpgsql
set search_path = public, pg_temp as $$ begin raise exception 'Late payment audit events are append only'; end $$;
drop trigger if exists late_payment_audit_immutable on public.invoice_late_payment_events;
create trigger late_payment_audit_immutable before update or delete on public.invoice_late_payment_events
for each row execute function public.reject_late_payment_audit_mutation();
