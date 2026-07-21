-- Remove the temporary compatibility objects after the established-workspace
-- repair migration has completed. The final production schema remains clean.

BEGIN;

DROP AGGREGATE IF EXISTS public.min(uuid);
DROP FUNCTION IF EXISTS public.xdrive_uuid_min_state(uuid, uuid);

COMMIT;
