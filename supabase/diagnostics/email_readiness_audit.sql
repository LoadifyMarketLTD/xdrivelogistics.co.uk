-- email_readiness_audit.sql
-- Safe read-only Supabase SQL audit for XDrive notification email automation.
-- Run in Supabase SQL Editor. It does not send email and does not modify data.

select
  'notification_events_counts' as section,
  status,
  count(*) as count
from public.notification_events
group by status
order by status;

select
  'recent_pending_or_failed_events' as section,
  id,
  event_type,
  status,
  processed_at,
  created_at,
  payload
from public.notification_events
where status in ('pending', 'failed')
order by created_at desc
limit 25;

select
  'app_settings_presence' as section,
  key,
  case when nullif(value, '') is not null then true else false end as configured
from public.app_settings
where key in ('supabase_project_ref', 'supabase_service_role_key')
order by key;

select
  'trigger_function_exists' as section,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'trigger_notify_operational_event'
  ) as ok;

select
  'notification_events_trigger_exists' as section,
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notification_events'
      and t.tgname = 'on_notification_event_insert'
      and not t.tgisinternal
  ) as ok;

select
  'pg_net_extension_exists' as section,
  exists (select 1 from pg_extension where extname = 'pg_net') as ok;

select
  'edge_function_manual_check_required' as section,
  'Verify notify-operational-event is deployed with --no-verify-jwt and has RESEND_API_KEY, SITE_URL, FROM_EMAIL secrets in Supabase dashboard.' as note;