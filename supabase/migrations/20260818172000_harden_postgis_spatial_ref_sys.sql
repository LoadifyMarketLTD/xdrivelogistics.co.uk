-- Security hardening for PostGIS metadata exposed through the public schema.
--
-- Context:
-- - Existing production has PostGIS installed in public and therefore exposes
--   public.spatial_ref_sys through the Data API schema.
-- - The extension currently grants broad DML privileges to anon/authenticated.
-- - XDrive must preserve PostGIS until the legacy geography dependency on
--   driver_locations.location is migrated safely.
--
-- This migration is intentionally non-destructive:
-- - it does not drop or relocate PostGIS;
-- - it does not modify spatial_ref_sys data;
-- - it keeps read access required for spatial reference lookups;
-- - it removes client-side write access and enables RLS;
-- - it is a no-op on databases where PostGIS/spatial_ref_sys is absent.

DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';

    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.spatial_ref_sys FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.spatial_ref_sys TO anon, authenticated';

    EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_read_only ON public.spatial_ref_sys';
    EXECUTE 'CREATE POLICY spatial_ref_sys_read_only ON public.spatial_ref_sys FOR SELECT TO anon, authenticated USING (true)';
  END IF;
END
$$;
