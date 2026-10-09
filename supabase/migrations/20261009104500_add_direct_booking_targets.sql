begin;

alter table public.jobs
  add column if not exists direct_booking_target_type text,
  add column if not exists external_subcontractor_name text,
  add column if not exists external_subcontractor_company text,
  add column if not exists external_subcontractor_email text,
  add column if not exists external_subcontractor_phone text,
  add column if not exists external_subcontractor_payment_terms text;

alter table public.jobs
  drop constraint if exists jobs_direct_booking_target_type_check;

alter table public.jobs
  add constraint jobs_direct_booking_target_type_check
  check (
    direct_booking_target_type is null
    or direct_booking_target_type in ('exchange_member','external_subcontractor','internal_resource')
  );

comment on column public.jobs.direct_booking_target_type is
  'Direct Booking target: exchange_member, external_subcontractor, or internal_resource.';
comment on column public.jobs.external_subcontractor_name is
  'Booking-specific external subcontractor contact name.';
comment on column public.jobs.external_subcontractor_company is
  'Booking-specific external subcontractor business name.';

notify pgrst, 'reload schema';
commit;
