-- PostgreSQL does not provide min(uuid) on all supported versions, while the
-- canonical owner-driver award RPC uses MIN(driver.id) to select the sole
-- eligible driver. Add a type-specific aggregate without changing the RPC API.

BEGIN;

CREATE OR REPLACE FUNCTION public.uuid_min_state(p_left uuid, p_right uuid)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_left IS NULL THEN p_right
    WHEN p_right IS NULL THEN p_left
    WHEN p_left <= p_right THEN p_left
    ELSE p_right
  END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'min'
      AND p.prokind = 'a'
      AND p.proargtypes = ARRAY['uuid'::regtype::oid]::oidvector
  ) THEN
    CREATE AGGREGATE public.min(uuid) (
      SFUNC = public.uuid_min_state,
      STYPE = uuid,
      PARALLEL = SAFE
    );
  END IF;
END
$$;

COMMENT ON FUNCTION public.uuid_min_state(uuid, uuid) IS
  'State function for the public.min(uuid) compatibility aggregate used by owner-driver allocation.';

NOTIFY pgrst, 'reload schema';

COMMIT;
