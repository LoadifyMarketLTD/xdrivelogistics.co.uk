-- 064_extend_company_role_membership_values.sql
-- Extend the company membership enum with every canonical operational role.
--
-- Older clean schemas only contained owner/admin/dispatcher/viewer. Later
-- migrations and application authorization also use member, finance and driver,
-- so those values must exist before any policy or constraint references them.

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'company_role'
      AND e.enumlabel = 'finance'
  ) THEN
    ALTER TYPE public.company_role ADD VALUE 'finance' BEFORE 'member';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'company_role'
      AND e.enumlabel = 'driver'
  ) THEN
    ALTER TYPE public.company_role ADD VALUE 'driver' AFTER 'viewer';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
