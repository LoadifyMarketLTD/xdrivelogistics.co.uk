-- CRM suppression enforcement at database write boundary.
-- This is defense in depth: API checks are not sufficient against a direct
-- service-role insert, or an import that bypasses the HTTP route.
-- Deployment gate: review against the live schema before applying.
CREATE OR REPLACE FUNCTION public.crm_reject_suppressed_contact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  normalized_email text;
  normalized_phone text;
BEGIN
  normalized_email := lower(btrim(coalesce(NEW.business_email, '')));
  normalized_phone := regexp_replace(coalesce(NEW.business_phone, ''), '[[:space:]().-]', '', 'g');
  IF (normalized_email <> '' AND EXISTS (
    SELECT 1 FROM public.crm_prospect_suppressions
    WHERE channel IN ('email', 'all') AND normalized_contact_value = normalized_email
  )) OR (normalized_phone <> '' AND EXISTS (
    SELECT 1 FROM public.crm_prospect_suppressions
    WHERE channel IN ('phone', 'all') AND normalized_contact_value = normalized_phone
  )) THEN
    RAISE EXCEPTION 'CRM contact suppressed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_contact_suppression_guard ON public.crm_prospect_contacts;
CREATE TRIGGER crm_contact_suppression_guard
BEFORE INSERT OR UPDATE OF business_email, business_phone
ON public.crm_prospect_contacts
FOR EACH ROW EXECUTE FUNCTION public.crm_reject_suppressed_contact();

-- Never let a suppression be silently removed by a regular API user:
-- only privileged service operations can mutate the suppression registry.
REVOKE ALL ON FUNCTION public.crm_reject_suppressed_contact() FROM PUBLIC;
