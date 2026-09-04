-- Go-live hardening: make PostGIS spatial_ref_sys read-only through the exposed API.
-- This does not move or recreate the PostGIS extension and does not mutate spatial reference data.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.spatial_ref_sys
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.spatial_ref_sys TO anon, authenticated;

DROP POLICY IF EXISTS spatial_ref_sys_read_only ON public.spatial_ref_sys;
CREATE POLICY spatial_ref_sys_read_only
  ON public.spatial_ref_sys
  AS PERMISSIVE
  FOR SELECT
  TO anon, authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'spatial_ref_sys'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.spatial_ref_sys.';
  END IF;

  IF has_table_privilege('anon', 'public.spatial_ref_sys', 'INSERT')
     OR has_table_privilege('anon', 'public.spatial_ref_sys', 'UPDATE')
     OR has_table_privilege('anon', 'public.spatial_ref_sys', 'DELETE')
     OR has_table_privilege('authenticated', 'public.spatial_ref_sys', 'INSERT')
     OR has_table_privilege('authenticated', 'public.spatial_ref_sys', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.spatial_ref_sys', 'DELETE') THEN
    RAISE EXCEPTION 'anon/authenticated retain write privileges on public.spatial_ref_sys.';
  END IF;

  IF NOT has_table_privilege('anon', 'public.spatial_ref_sys', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.spatial_ref_sys', 'SELECT') THEN
    RAISE EXCEPTION 'Expected read access was not preserved on public.spatial_ref_sys.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
