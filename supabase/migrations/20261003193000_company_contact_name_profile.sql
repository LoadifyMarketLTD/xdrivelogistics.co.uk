-- Canonical company contact person used across workspace and member profile.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS contact_name text;

COMMENT ON COLUMN public.companies.contact_name IS
  'Primary business contact person for the company. Company-scoped identity; not derived from auth/profile user identity.';

WITH latest_contact AS (
  SELECT DISTINCT ON (oa.company_id)
    oa.company_id,
    COALESCE(
      NULLIF(btrim(oa.payload->>'contact_person'), ''),
      NULLIF(btrim(fcp.contact_person), '')
    ) AS contact_name
  FROM public.onboarding_applications oa
  LEFT JOIN public.fleet_compliance_profiles fcp
    ON fcp.onboarding_application_id = oa.id
  WHERE oa.company_id IS NOT NULL
    AND (
      NULLIF(btrim(oa.payload->>'contact_person'), '') IS NOT NULL
      OR NULLIF(btrim(fcp.contact_person), '') IS NOT NULL
    )
  ORDER BY oa.company_id, oa.updated_at DESC NULLS LAST, oa.created_at DESC
)
UPDATE public.companies c
SET contact_name = latest_contact.contact_name
FROM latest_contact
WHERE c.id = latest_contact.company_id
  AND NULLIF(btrim(c.contact_name), '') IS NULL
  AND latest_contact.contact_name IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_company_contact_name_from_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact text;
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_contact := NULLIF(btrim(COALESCE(NEW.payload->>'contact_person', '')), '');
  IF v_contact IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.companies
  SET contact_name = v_contact
  WHERE id = NEW.company_id
    AND contact_name IS DISTINCT FROM v_contact;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_contact_name_from_onboarding
  ON public.onboarding_applications;

CREATE TRIGGER trg_sync_company_contact_name_from_onboarding
AFTER INSERT OR UPDATE OF company_id, payload
ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_contact_name_from_onboarding();