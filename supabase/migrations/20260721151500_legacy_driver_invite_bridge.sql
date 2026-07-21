BEGIN;

CREATE OR REPLACE FUNCTION public.bridge_legacy_fleet_driver_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_created_by uuid;
BEGIN
  IF NEW.role_in_company NOT IN ('driver', 'member') OR NEW.status <> 'invited' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_driver
  FROM public.drivers d
  WHERE d.company_id = NEW.company_id
    AND d.user_id = NEW.user_id
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.fleet_driver_invitations fdi WHERE fdi.driver_id = v_driver.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    c.created_by,
    (
      SELECT cm.user_id
      FROM public.company_memberships cm
      WHERE cm.company_id = NEW.company_id
        AND cm.status = 'active'
        AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
      ORDER BY CASE cm.role_in_company WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
               cm.created_at
      LIMIT 1
    )
  )
  INTO v_created_by
  FROM public.companies c
  WHERE c.id = NEW.company_id;

  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'Cannot create fleet driver invitation without a company operator.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.fleet_driver_invitations (
    company_id,
    driver_id,
    user_id,
    invited_email,
    token_hash,
    status,
    expires_at,
    last_sent_at,
    created_by
  ) VALUES (
    NEW.company_id,
    v_driver.id,
    NEW.user_id,
    lower(trim(COALESCE(NEW.invited_email, v_driver.email))),
    NULL,
    'invited',
    now() + interval '48 hours',
    now(),
    v_created_by
  )
  ON CONFLICT (driver_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_legacy_fleet_driver_invitation ON public.company_memberships;
CREATE TRIGGER trg_bridge_legacy_fleet_driver_invitation
AFTER INSERT OR UPDATE OF status, role_in_company, user_id, company_id, invited_email
ON public.company_memberships
FOR EACH ROW
EXECUTE FUNCTION public.bridge_legacy_fleet_driver_invitation();

REVOKE ALL ON FUNCTION public.bridge_legacy_fleet_driver_invitation() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
