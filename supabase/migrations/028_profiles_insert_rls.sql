-- ============================================================
-- 028_profiles_insert_rls.sql
--
-- Adds a missing INSERT RLS policy on public.profiles.
--
-- Migration 017 defines SELECT and UPDATE self-access policies for
-- profiles but omits an INSERT policy. Because RLS is enabled,
-- the anon/authenticated role cannot insert their own profile row
-- directly from the client (e.g. after supabase.auth.signUp()).
-- The trigger function in migration 026 uses SECURITY DEFINER so
-- it is unaffected, but client-side upserts in register/page.tsx
-- silently fail because no INSERT policy exists.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own" ON public.profiles
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
