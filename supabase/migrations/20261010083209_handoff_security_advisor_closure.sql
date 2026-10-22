alter function public.fn_notification_event_title(text) set search_path = pg_catalog;
alter function public.fn_notification_event_body(text, jsonb) set search_path = pg_catalog;
revoke all on function public.fn_notify_job_smart_milestones() from public, anon, authenticated;
revoke all on function public.fn_notify_job_smart_proximity() from public, anon, authenticated;
grant execute on function public.fn_notify_job_smart_milestones() to service_role;
grant execute on function public.fn_notify_job_smart_proximity() to service_role;
