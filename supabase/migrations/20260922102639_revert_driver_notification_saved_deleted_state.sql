begin;
drop index if exists public.notifications_user_deleted_created_idx;
alter table public.notifications drop column if exists saved_at;
alter table public.notifications drop column if exists deleted_at;
notify pgrst, 'reload schema';
commit;
