BEGIN;

CREATE OR REPLACE FUNCTION public.preserve_legacy_driver_remediation_review_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF COALESCE((NEW.payload->>'legacy_driver_compliance_remediation')::boolean, false) = true
     AND NEW.current_step = 'compliance_remediation'
     AND NEW.status = 'in_progress'
  THEN
    NEW.status := 'under_review';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_preserve_legacy_driver_remediation_review_state
  ON public.onboarding_applications;

CREATE TRIGGER trg_preserve_legacy_driver_remediation_review_state
BEFORE UPDATE OF status, current_step, payload
ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.preserve_legacy_driver_remediation_review_state();

REVOKE ALL ON FUNCTION public.preserve_legacy_driver_remediation_review_state() FROM PUBLIC, anon, authenticated;

COMMIT;
