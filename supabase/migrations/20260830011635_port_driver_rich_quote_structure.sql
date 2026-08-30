alter table public.job_bids
  add column if not exists base_amount numeric,
  add column if not exists collect_within_minutes integer,
  add column if not exists additional_extras_gbp numeric;

alter table public.job_bids
  drop constraint if exists job_bids_base_amount_check,
  add constraint job_bids_base_amount_check
    check (base_amount is null or (base_amount > 0 and base_amount <= 1000000));

alter table public.job_bids
  drop constraint if exists job_bids_collect_within_minutes_check,
  add constraint job_bids_collect_within_minutes_check
    check (collect_within_minutes is null or collect_within_minutes between 5 and 240);

alter table public.job_bids
  drop constraint if exists job_bids_additional_extras_gbp_check,
  add constraint job_bids_additional_extras_gbp_check
    check (additional_extras_gbp is null or (additional_extras_gbp >= 0 and additional_extras_gbp <= 1000000));

comment on column public.job_bids.base_amount is 'Driver-entered base quote amount excluding explicit extras.';
comment on column public.job_bids.collect_within_minutes is 'Driver-declared minutes to collection after quote acceptance.';
comment on column public.job_bids.additional_extras_gbp is 'Structured quoted extras excluding the base quote.';

notify pgrst, 'reload schema';
