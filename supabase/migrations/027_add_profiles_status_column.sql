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
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

NOTIFY pgrst, 'reload schema';
