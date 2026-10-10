-- Hotfix: allow the Driver Load Alerts trigger to resolve PostGIS types/functions.
-- PostGIS is installed in the extensions schema in Supabase.
-- Without extensions in search_path, ::geography raises SQLSTATE 42704
-- during marketplace job publication and rolls back the jobs INSERT.

alter function public.fn_enqueue_driver_load_alerts_for_job(uuid, uuid)
  set search_path = public, extensions, pg_temp;
