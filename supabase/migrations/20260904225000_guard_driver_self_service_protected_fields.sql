-- Go-live hardening: prevent a driver from using the broad legacy self-update
-- policy to grant themselves operational/commercial privileges.
--
-- Driver self-service currently writes safe preference fields directly on
-- public.drivers (availability and destination matching). Keep that flow working,
-- but fail closed if the same authenticated driver attempts to change identity,
-- tenant binding, access/suspension, credential-control or commercial-approval
-- fields. Service-role/server mutations have auth.uid() = NULL and are not
-- constrained by this client-side backstop.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.guard_driver_self_service_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  -- Internal/server mutations are governed by their own trusted route/RPC.
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only police the driver's own legacy direct-update path. Other callers still
  -- have to satisfy the table RLS policies before this trigger can be reached.
  IF OLD.user_id = v_actor THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.app_access IS DISTINCT FROM OLD.app_access
       OR NEW.temporary_password_seq IS DISTINCT FROM OLD.temporary_password_seq
       OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
       OR NEW.temp_password_generated_at IS DISTINCT FROM OLD.temp_password_generated_at
       OR NEW.international_work_approved IS DISTINCT FROM OLD.international_work_approved
       OR NEW.driver_type IS DISTINCT FROM OLD.driver_type
       OR NEW.can_commercial_bid IS DISTINCT FROM OLD.can_commercial_bid THEN
      RAISE EXCEPTION 'Driver self-service cannot modify protected driver fields.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_driver_self_service_protected_fields ON public.drivers;
CREATE TRIGGER trg_guard_driver_self_service_protected_fields
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_driver_self_service_protected_fields();

REVOKE ALL ON FUNCTION public.guard_driver_self_service_protected_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_driver_self_service_protected_fields() TO service_role;

COMMIT;
