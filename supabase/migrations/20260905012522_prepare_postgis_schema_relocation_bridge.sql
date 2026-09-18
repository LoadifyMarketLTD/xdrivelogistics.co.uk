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

commit;;
