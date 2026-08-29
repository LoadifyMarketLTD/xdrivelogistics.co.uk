-- Close PR #399 load-alert helper and trigger-function security advisor findings.

alter function public.fn_load_alert_outcode(text)
  set search_path = public, pg_temp;

alter function public.fn_load_alert_vehicle_key(text)
  set search_path = public, pg_temp;

alter function public.fn_notification_event_title(text)
  set search_path = public, pg_temp;

alter function public.fn_notification_event_body(text, jsonb)
  set search_path = public, pg_temp;

revoke execute on function public.fn_notify_driver_load_alert_on_marketplace_change()
  from public, anon, authenticated;
grant execute on function public.fn_notify_driver_load_alert_on_marketplace_change()
  to service_role;
