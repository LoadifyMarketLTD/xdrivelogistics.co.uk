begin;

alter table public.notifications
  add column if not exists saved_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists notifications_user_deleted_created_idx
  on public.notifications(user_id, deleted_at, created_at desc);

comment on column public.notifications.saved_at is
  'Driver inbox saved state. Null means not saved.';
comment on column public.notifications.deleted_at is
  'Driver inbox soft-delete state. Restorable from the Deleted tab.';

notify pgrst, 'reload schema';

commit;
