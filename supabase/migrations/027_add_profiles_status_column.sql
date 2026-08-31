-- ============================================================
-- 027_add_profiles_status_column.sql
--
-- Adds the `status` column to public.profiles.
--
-- Migration 026 introduced a trigger (handle_auth_user_profile_sync)
-- that inserts `status` into profiles on every new auth.users INSERT.
-- Because no prior migration added that column the trigger fails
-- at runtime with:
--   "column status of relation profiles does not exist"
-- which Supabase surfaces as "Database error saving new user" or
-- "Database error creating new user", breaking ALL user-creation
-- paths including admin-created driver accounts.
--
-- Hosted production uses public.user_status with exactly
-- pending/active/blocked. Reconstruct that physical contract here, before later
-- policies and Driver identity triggers bind to profiles.status. Existing text
-- drift is converted only when all current values fit the hosted enum.
-- ============================================================

DO $$
DECLARE
  v_kind "char";
  v_labels text[];
  v_invalid text[];
  v_uses_user_status boolean;
BEGIN
  IF to_regtype('public.user_status') IS NULL THEN
    EXECUTE 'CREATE TYPE public.user_status AS ENUM (''pending'', ''active'', ''blocked'')';
  ELSE
    SELECT t.typtype
    INTO v_kind
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_status';

    IF v_kind IS DISTINCT FROM 'e'::"char" THEN
      RAISE EXCEPTION 'public.user_status exists but is not an enum type.';
    END IF;

    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
    INTO v_labels
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'user_status';

    IF v_labels IS DISTINCT FROM ARRAY['pending', 'active', 'blocked']::text[] THEN
      RAISE EXCEPTION
        'public.user_status labels differ from the hosted canonical contract: %.',
        coalesce(array_to_string(v_labels, ', '), '<none>');
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN status public.user_status NOT NULL DEFAULT 'active'::public.user_status;
  ELSE
    SELECT array_agg(DISTINCT p.status::text ORDER BY p.status::text)
    INTO v_invalid
    FROM public.profiles p
    WHERE p.status IS NOT NULL
      AND p.status::text NOT IN ('pending', 'active', 'blocked');

    IF coalesce(array_length(v_invalid, 1), 0) > 0 THEN
      RAISE EXCEPTION
        'Unsupported profile status values prevent canonical user_status reconstruction: %.',
        array_to_string(v_invalid, ', ');
    END IF;

    SELECT c.udt_schema = 'public' AND c.udt_name = 'user_status'
    INTO v_uses_user_status
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'profiles' AND c.column_name = 'status';

    IF NOT coalesce(v_uses_user_status, false) THEN
      ALTER TABLE public.profiles ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE public.profiles
        ALTER COLUMN status TYPE public.user_status
        USING status::text::public.user_status;
      ALTER TABLE public.profiles
        ALTER COLUMN status SET DEFAULT 'active'::public.user_status;
      ALTER TABLE public.profiles ALTER COLUMN status SET NOT NULL;
    END IF;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
