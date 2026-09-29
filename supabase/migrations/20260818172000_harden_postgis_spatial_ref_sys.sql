-- Security hardening for PostGIS metadata.
--
-- Historical production originally had PostGIS in public. Supabase Support
-- relocated the managed extension to extensions on 26 September 2026.
-- Fresh repository replay must therefore install PostGIS in extensions while
-- remaining compatible with older databases that still have it in public.
--
-- This migration is intentionally non-destructive and owner-aware:
-- - it installs PostGIS in extensions only when absent;
-- - it never relocates or drops an existing PostGIS installation;
-- - it never modifies spatial_ref_sys data;
-- - public-schema hardening is applied only when spatial_ref_sys is actually
--   exposed in public;
-- - extensions.spatial_ref_sys is left under Supabase-managed ownership.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

DO $$
DECLARE
  v_postgis_schema name;
  v_owner name;
  v_can_act_as_owner boolean;
BEGIN
  SELECT n.nspname
    INTO v_postgis_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'postgis';

  IF v_postgis_schema NOT IN ('public', 'extensions') THEN
    RAISE EXCEPTION
      'Unexpected PostGIS schema %; expected public or extensions.',
      COALESCE(v_postgis_schema::text, '<missing>');
  END IF;

  IF v_postgis_schema = 'extensions' THEN
    IF to_regclass('extensions.spatial_ref_sys') IS NULL THEN
      RAISE EXCEPTION
        'PostGIS is installed in extensions but extensions.spatial_ref_sys is missing.';
    END IF;

    RAISE NOTICE
      'PostGIS is isolated in extensions; public spatial_ref_sys hardening is not required.';
    RETURN;
  END IF;

  IF to_regclass('public.spatial_ref_sys') IS NULL THEN
    RAISE EXCEPTION
      'PostGIS is installed in public but public.spatial_ref_sys is missing.';
  END IF;

  SELECT pg_get_userbyid(c.relowner)
    INTO v_owner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'spatial_ref_sys';

  v_can_act_as_owner :=
    v_owner = current_user
    OR pg_has_role(current_user, v_owner, 'MEMBER');

  IF NOT v_can_act_as_owner THEN
    RAISE NOTICE
      'Skipping spatial_ref_sys hardening: relation owner is %, migration role is %, and the migration role cannot act as the owner. Extension-owned object left unchanged.',
      v_owner,
      current_user;
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';

  EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.spatial_ref_sys FROM anon, authenticated';
  EXECUTE 'GRANT SELECT ON TABLE public.spatial_ref_sys TO anon, authenticated';

  EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_read_only ON public.spatial_ref_sys';
  EXECUTE 'CREATE POLICY spatial_ref_sys_read_only ON public.spatial_ref_sys FOR SELECT TO anon, authenticated USING (true)';
END
$$;
