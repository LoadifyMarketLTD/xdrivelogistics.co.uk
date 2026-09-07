-- Prepare XDrive runtime functions for a Supabase Support-assisted PostGIS
-- relocation from public -> extensions without changing the extension itself.
--
-- Why this exists:
-- - hosted Production currently has PostGIS 3.3.7 in public;
-- - public.spatial_ref_sys is owned by supabase_admin, so normal migrations
--   cannot perform the owner-only hardening/relocation safely;
-- - two XDrive runtime functions resolve PostGIS names through search_path;
-- - including both public and extensions lets those same function bodies keep
--   resolving before and immediately after Support moves the extension.
--
-- This migration does NOT:
-- - move PostGIS;
-- - mutate pg_extension;
-- - drop/recreate spatial data;
-- - use DROP EXTENSION ... CASCADE.
--
-- Both public and extensions are non-CREATE schemas for anon/authenticated on
-- hosted XDrive, so adding extensions to these pinned paths does not open a
-- client object-shadowing path. A post-relocation follow-up can fully qualify
-- extensions.st_* and tighten the path further.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  v_postgis_schema name;
begin
  select n.nspname
    into v_postgis_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'postgis';

  if v_postgis_schema is null then
    raise exception 'PostGIS is required by XDrive driver_locations but is not installed.';
  end if;

  if v_postgis_schema not in ('public', 'extensions') then
    raise exception 'Unexpected PostGIS schema: %', v_postgis_schema;
  end if;

  if to_regprocedure('public.fn_sync_driver_location_coordinates()') is not null then
    alter function public.fn_sync_driver_location_coordinates()
      set search_path = public, extensions, pg_catalog;
  end if;

  if to_regprocedure('public.fn_enqueue_driver_load_alerts_for_job(uuid,uuid)') is not null then
    alter function public.fn_enqueue_driver_load_alerts_for_job(uuid, uuid)
      set search_path = public, extensions, pg_catalog;
  end if;
end
$$;

commit;
