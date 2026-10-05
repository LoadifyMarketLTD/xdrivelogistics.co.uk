BEGIN;

REVOKE EXECUTE ON FUNCTION public.fn_apply_accepted_job_amendment()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_company_contact_name_from_onboarding()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_apply_accepted_job_amendment() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_company_contact_name_from_onboarding() TO service_role;

COMMIT;