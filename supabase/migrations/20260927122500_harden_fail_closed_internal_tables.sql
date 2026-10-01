BEGIN;

-- These tables are intentionally server-side/fail-closed in Production:
-- RLS is enabled and there are no tenant/browser policies. Keep the privilege
-- layer aligned with that design so anon/authenticated cannot reach them over
-- the Data API even if policies are added accidentally later.

-- Fresh databases do not run the production-only backup ops script, so the
-- backup table can legitimately be absent. Harden each internal table only
-- when it exists instead of making a fresh-schema migration fail closed.
DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'backup_20260721221000_auth_users_metadata',
    'company_membership_workspace_access',
    'platform_feature_flags'
  ]
  LOOP
    IF to_regclass(format('public.%I', relation_name)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
        relation_name
      );
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I TO service_role',
        relation_name
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
