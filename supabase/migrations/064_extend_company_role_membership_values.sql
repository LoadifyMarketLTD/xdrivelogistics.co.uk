-- 064_extend_company_role_membership_values.sql
-- Extend company membership enums with every canonical operational value.
--
-- Older clean schemas only contained owner/admin/dispatcher/viewer roles and
-- invited/active/suspended statuses. Later migrations and application
-- authorization also use member, finance, driver and disabled, so those values
-- must exist before any policy or constraint references them.

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'membership_status'
      AND e.enumlabel = 'disabled'
  ) THEN
    ALTER TYPE public.membership_status ADD VALUE 'disabled' BEFORE 'suspended';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

-- Touchpoint: validates the downstream helper-parameter repair in clean bootstrap.
