-- Remove the legacy auth trigger that promoted user-controlled metadata into
-- authoritative profile roles. The canonical profile sync uses app_metadata
-- only and leaves unapproved public signup roles NULL.

BEGIN;

DROP TRIGGER IF EXISTS trg_enforce_profile_role_from_auth_users ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_profile_role_from_auth_users();

COMMIT;
