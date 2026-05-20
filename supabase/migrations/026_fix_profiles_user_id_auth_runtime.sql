-- ============================================================
-- 026_fix_profiles_user_id_auth_runtime.sql
--
-- Consolidated runtime-safe patch for live auth failures:
-- - Align public.profiles identity column to user_id
-- - Align profile self RLS policies to user_id
-- - Replace auth.users INSERT triggers with a safe profile upsert trigger
--   that only writes columns present in live schema
-- ============================================================

BEGIN;

-- 1) Align profiles PK column to user_id without destructive rename.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill user_id from legacy id if that column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'id'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET user_id = id WHERE user_id IS NULL';
  END IF;
END $$;

-- Ensure user_id is the FK to auth.users.id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'user_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT tc.constraint_name
    INTO pk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
   AND tc.table_name = kcu.table_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'profiles'
    AND tc.constraint_type = 'PRIMARY KEY'
    AND kcu.column_name <> 'user_id'
  LIMIT 1;

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', pk_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
     AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'profiles'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_user_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Align RLS policies to user_id.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (user_id = auth.uid());

-- 3) Runtime-safe auth.users -> profiles trigger.
CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
  v_phone text;
  v_is_driver boolean;
BEGIN
  v_role := COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    NEW.raw_user_meta_data ->> 'requested_role',
    'customer'
  );
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name'
  );
  v_phone := NEW.raw_user_meta_data ->> 'phone';
  v_is_driver := LOWER(COALESCE(v_role, '')) = 'driver';

  INSERT INTO public.profiles (user_id, role, status, full_name, phone, is_driver, created_at, updated_at)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data ->> 'status', 'active'),
    v_full_name,
    v_phone,
    v_is_driver,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE
    SET role = COALESCE(EXCLUDED.role, public.profiles.role),
        status = COALESCE(EXCLUDED.status, public.profiles.status),
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        is_driver = EXCLUDED.is_driver,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Remove existing custom INSERT triggers on auth.users (likely stale/broken profile trigger).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
      AND (tgtype & 4) = 4 -- INSERT event
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', t.tgname);
  END LOOP;
END $$;

CREATE TRIGGER on_auth_user_profile_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_profile_sync();

COMMIT;

NOTIFY pgrst, 'reload schema';
