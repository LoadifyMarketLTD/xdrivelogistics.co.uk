begin;

alter table public.jobs
  add column if not exists pickup_proximity_alert_enabled boolean not null default true,
  add column if not exists delivery_proximity_alert_enabled boolean not null default true,
  add column if not exists smart_alerts_updated_at timestamptz;

comment on column public.jobs.pickup_proximity_alert_enabled is
  'Enable the pickup-radius Smart Alert when booking Smart Alerts are enabled.';
comment on column public.jobs.delivery_proximity_alert_enabled is
  'Enable the delivery-radius Smart Alert when booking Smart Alerts are enabled.';
comment on column public.jobs.smart_alerts_updated_at is
  'Last explicit Smart / Pro Alert configuration update for this booking.';

notify pgrst, 'reload schema';
commit;
