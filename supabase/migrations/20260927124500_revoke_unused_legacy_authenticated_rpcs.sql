BEGIN;

-- Production audit 2026-09-27:
-- These SECURITY DEFINER helpers have no current repository callers, are not
-- referenced by RLS/storage policies, and showed no RPC traffic in the audited
-- 24-hour window. Keep server-side execution available while removing direct
-- signed-in browser/API exposure.

DO $$
BEGIN
  IF to_regprocedure('public.get_my_role_status()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_my_role_status()
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_my_role_status()
      TO service_role;
  END IF;

  IF to_regprocedure('public.is_company_members_admin(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.is_company_members_admin(uuid)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.is_company_members_admin(uuid)
      TO service_role;
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
