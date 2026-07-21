BEGIN;

CREATE OR REPLACE FUNCTION public.guard_fleet_driver_membership_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  IF NEW.role_in_company NOT IN ('driver', 'member') OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT d.id INTO v_driver_id
  FROM public.drivers d
  WHERE d.company_id = NEW.company_id
    AND d.user_id = NEW.user_id
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fleet_driver_invitations fdi
    WHERE fdi.driver_id = v_driver_id
  ) AND NOT public.fleet_driver_compliance_current(v_driver_id) THEN
    NEW.status := 'invited';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_fleet_driver_membership_activation
  ON public.company_memberships;
CREATE TRIGGER trg_guard_fleet_driver_membership_activation
BEFORE INSERT OR UPDATE OF status, role_in_company, user_id, company_id
ON public.company_memberships
FOR EACH ROW
EXECUTE FUNCTION public.guard_fleet_driver_membership_activation();

CREATE OR REPLACE FUNCTION public.sync_fleet_driver_document_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver_id uuid;
  v_access_allowed boolean;
BEGIN
  v_driver_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.driver_id ELSE NEW.driver_id END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.fleet_driver_invitations fdi
    WHERE fdi.driver_id = v_driver_id
  ) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_access_allowed := public.fleet_driver_compliance_current(v_driver_id);

  UPDATE public.drivers
  SET app_access = v_access_allowed,
      updated_at = now()
  WHERE id = v_driver_id;

  IF NOT v_access_allowed THEN
    UPDATE public.company_memberships cm
    SET status = 'invited',
        updated_at = now()
    FROM public.drivers d
    WHERE d.id = v_driver_id
      AND cm.company_id = d.company_id
      AND cm.user_id = d.user_id
      AND cm.role_in_company IN ('driver', 'member')
      AND cm.status = 'active';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_fleet_driver_document_access
  ON public.driver_documents;
CREATE TRIGGER trg_sync_fleet_driver_document_access
AFTER INSERT OR UPDATE OF file_path, status, expiry_date OR DELETE
ON public.driver_documents
FOR EACH ROW
EXECUTE FUNCTION public.sync_fleet_driver_document_access();

REVOKE ALL ON FUNCTION public.guard_fleet_driver_membership_activation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_fleet_driver_document_access()
  FROM PUBLIC, anon, authenticated;

COMMIT;
