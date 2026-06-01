-- 064_extend_company_role_membership_values.sql
-- Extend company membership enum with explicit member role.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'company_role'
      AND e.enumlabel = 'member'
  ) THEN
    ALTER TYPE public.company_role ADD VALUE 'member' BEFORE 'viewer';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
