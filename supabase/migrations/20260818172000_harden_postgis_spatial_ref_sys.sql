-- Security hardening for PostGIS metadata exposed through the public schema.
--
-- Context:
-- - Existing production has PostGIS installed in public and therefore exposes
--   public.spatial_ref_sys through the Data API schema.
-- - XDrive must preserve PostGIS until the legacy geography dependency on
--   driver_locations.location is migrated safely.
-- - On Supabase-hosted production, spatial_ref_sys can be extension-owned by
--   supabase_admin while normal migrations execute as postgres. PostgreSQL
--   correctly rejects owner-only ALTER TABLE / CREATE POLICY operations in
--   that case.
--
-- This migration is intentionally non-destructive and owner-aware:
-- - it does not drop or relocate PostGIS;
-- - it does not modify spatial_ref_sys data;
-- - it is a no-op when PostGIS/spatial_ref_sys is absent;
-- - when the migration role owns (or is a member of the owning role), it
--   removes client-side write access, preserves SELECT, and enables read-only
--   RLS;
-- - when the table is owned by a Supabase-managed role that the migration role
--   cannot act as, it emits a NOTICE and leaves the extension-owned object
--   untouched instead of blocking unrelated XDrive forward migrations.

DO $$
DECLARE
  v_owner name;
  v_can_act_as_owner boolean;
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NULL THEN
    RETURN;
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
