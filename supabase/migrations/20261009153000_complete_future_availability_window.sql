begin;

alter table public.drivers
  add column if not exists future_position_until timestamptz,
  add column if not exists future_availability_notes text;

comment on column public.drivers.future_position_until is
  'Optional end of the currently published future-position availability window.';
comment on column public.drivers.future_availability_notes is
  'Optional operational notes attached to the published future-position declaration.';

notify pgrst, 'reload schema';
commit;
