-- PostgreSQL versions differ on whether min(uuid) is available. The following
-- migration is ordered immediately before the established-workspace repair,
-- which uses min(company.id) only after proving there is exactly one row.
-- The aggregate is removed by the next migration after that repair runs.

BEGIN;

CREATE OR REPLACE FUNCTION public.xdrive_uuid_min_state(p_left uuid, p_right uuid)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_left IS NULL THEN p_right
    WHEN p_right IS NULL THEN p_left
    WHEN p_left::text <= p_right::text THEN p_left
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
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) THEN
    EXECUTE $aggregate$
      CREATE AGGREGATE public.min(uuid) (
        SFUNC = public.xdrive_uuid_min_state,
        STYPE = uuid,
        COMBINEFUNC = public.xdrive_uuid_min_state,
        PARALLEL = SAFE
      )
    $aggregate$;
  END IF;
END;
$$;

COMMIT;
