-- 064_extend_company_role_membership_values.sql
-- Extend operational enums with every canonical value used by later migrations.
--
-- Older clean schemas only contained owner/admin/dispatcher/viewer roles,
-- invited/active/suspended membership statuses and the first-generation tracking
-- events. Later migrations require the additional values below before policies,
-- constraints or functions can reference them.

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

DO $$
DECLARE
  v_value text;
BEGIN
  FOREACH v_value IN ARRAY ARRAY[
    'awarded',
    'on_my_way_to_pickup',
    'on_site_pickup',
    'loaded',
    'on_my_way_to_delivery',
    'on_site_delivery'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'tracking_event_type'
        AND e.enumlabel = v_value
    ) THEN
      EXECUTE format('ALTER TYPE public.tracking_event_type ADD VALUE %L', v_value);
    END IF;
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
