BEGIN;

-- These tables are intentionally server-side/fail-closed in Production:
-- RLS is enabled and there are no tenant/browser policies. Keep the privilege
-- layer aligned with that design so anon/authenticated cannot reach them over
-- the Data API even if policies are added accidentally later.

REVOKE ALL PRIVILEGES
ON TABLE public.backup_20260721221000_auth_users_metadata
FROM anon, authenticated;

REVOKE ALL PRIVILEGES
ON TABLE public.company_membership_workspace_access
FROM anon, authenticated;

-- Feature flags are consumed by server-side APIs / database code. The canonical
-- migration explicitly documents "no browser access", so direct SELECT grants
-- to anon/authenticated are unnecessary and widen the exposed surface.
REVOKE ALL PRIVILEGES
ON TABLE public.platform_feature_flags
FROM anon, authenticated;

-- Preserve server-side access explicitly.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.backup_20260721221000_auth_users_metadata
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.company_membership_workspace_access
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.platform_feature_flags
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
