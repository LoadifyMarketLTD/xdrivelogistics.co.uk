-- Migration 105: Block profile activation before email verification
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_require_verified_email_for_profile_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_confirmed_at timestamptz;
BEGIN
  IF NEW.status = 'active'
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
     AND COALESCE(NEW.is_driver, false) = false
  THEN
    SELECT u.email_confirmed_at
    INTO v_email_confirmed_at
    FROM auth.users u
    WHERE u.id = NEW.user_id
    LIMIT 1;

    IF v_email_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'Profile cannot become active before email verification.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_verified_email_for_profile_activation ON public.profiles;
CREATE TRIGGER trg_require_verified_email_for_profile_activation
  BEFORE INSERT OR UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_require_verified_email_for_profile_activation();

COMMIT;
