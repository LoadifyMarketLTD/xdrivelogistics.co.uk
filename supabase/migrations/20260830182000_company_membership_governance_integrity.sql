BEGIN;

-- P0-03: an ACTIVE membership may exist only inside an ACTIVE company.
-- The legacy pending-creator guard was request-context dependent, allowing
-- service-role/bootstrap paths to leave active owner memberships on companies
-- that were still pending approval. Make the company state authoritative at the
-- database boundary for every writer.

CREATE OR REPLACE FUNCTION public.guard_pending_creator_membership_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_status text;
BEGIN
  IF NEW.company_id IS NULL OR NEW.status::text <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT c.status::text
  INTO v_company_status
  FROM public.companies c
  WHERE c.id = NEW.company_id;

  IF v_company_status IS NULL THEN
    RAISE EXCEPTION 'Company does not exist for membership activation.'
      USING ERRCODE = '23503';
  END IF;

  IF v_company_status <> 'active' THEN
    NEW.status := CASE
      WHEN v_company_status IN ('rejected', 'suspended', 'inactive') THEN 'disabled'
      ELSE 'invited'
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_pending_creator_membership_activation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_pending_creator_membership_activation() FROM anon;
REVOKE ALL ON FUNCTION public.guard_pending_creator_membership_activation() FROM authenticated;

DROP TRIGGER IF EXISTS trg_guard_pending_creator_membership_activation
  ON public.company_memberships;
CREATE TRIGGER trg_guard_pending_creator_membership_activation
BEFORE INSERT OR UPDATE OF company_id, status
ON public.company_memberships
FOR EACH ROW
EXECUTE FUNCTION public.guard_pending_creator_membership_activation();

-- A governance transition away from ACTIVE revokes membership authority in the
-- same transaction. No user/profile is deleted; approval can later reactivate the
-- creator through the existing canonical activation trigger.
CREATE OR REPLACE FUNCTION public.fail_close_company_memberships_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status::text IS DISTINCT FROM OLD.status::text
     AND NEW.status::text <> 'active' THEN
    UPDATE public.company_memberships
    SET status = CASE
          WHEN NEW.status::text IN ('rejected', 'suspended', 'inactive') THEN 'disabled'
          ELSE 'invited'
        END,
        updated_at = now()
    WHERE company_id = NEW.id
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_close_company_memberships_on_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_close_company_memberships_on_status_change() FROM anon;
REVOKE ALL ON FUNCTION public.fail_close_company_memberships_on_status_change() FROM authenticated;

DROP TRIGGER IF EXISTS trg_fail_close_company_memberships_on_status_change
  ON public.companies;
CREATE TRIGGER trg_fail_close_company_memberships_on_status_change
AFTER UPDATE OF status
ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.fail_close_company_memberships_on_status_change();

-- Reconcile only the authority inconsistency. Pending companies remain pending;
-- rejected/suspended companies remain rejected/suspended. No company is approved
-- or activated by this migration.
UPDATE public.company_memberships cm
SET status = CASE
      WHEN c.status::text IN ('rejected', 'suspended', 'inactive') THEN 'disabled'
      ELSE 'invited'
    END,
    updated_at = now()
FROM public.companies c
WHERE c.id = cm.company_id
  AND cm.status = 'active'
  AND c.status::text <> 'active';

DO $$
DECLARE
  v_invalid_active_memberships integer;
BEGIN
  SELECT count(*)
  INTO v_invalid_active_memberships
  FROM public.company_memberships cm
  JOIN public.companies c ON c.id = cm.company_id
  WHERE cm.status = 'active'
    AND c.status::text <> 'active';

  IF v_invalid_active_memberships <> 0 THEN
    RAISE EXCEPTION
      'Company membership governance reconciliation failed: % active memberships remain on non-active companies.',
      v_invalid_active_memberships;
  END IF;
END;
$$;

COMMIT;
