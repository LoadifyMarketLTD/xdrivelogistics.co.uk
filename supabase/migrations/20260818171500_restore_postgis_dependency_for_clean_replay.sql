begin;

-- Hosted production depends on PostGIS in the public schema and already has the
-- extension installed. The repository clean-replay chain did not reconstruct
-- that dependency before later spatial hardening and driver-location migrations.
-- Installing it here is a no-op on hosted production and restores the observed
-- production contract for fresh preview databases.
create extension if not exists postgis with schema public;

-- Fail closed if an environment has PostGIS installed in a different schema.
-- Later migrations intentionally harden public.spatial_ref_sys and the hosted
-- driver_locations.location contract is public.geography(Point,4326).
do $$
declare
  v_schema text;
begin
  select n.nspname
    into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'postgis';

  if v_schema is distinct from 'public' then
    raise exception 'PostGIS must be installed in public to match the hosted XDrive spatial contract; found schema %.', coalesce(v_schema, '<missing>');
  end if;
end;
$$;

commit;
