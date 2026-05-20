-- ============================================================
-- 024_driver_self_select_rls.sql
--
-- Adds a Row Level Security policy that allows a driver to read
-- their own row in the `drivers` table using auth.uid() = user_id.
--
-- Without this, a driver authenticated via Supabase Auth has no
-- way to query their own driver record using the anon/user key
-- unless they are also a company_member — which drivers typically
-- are not.
--
-- Safe to re-run: guarded by an existence check on pg_policies.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  tablename  = 'drivers'
      AND  policyname = 'drivers_select_own'
  ) THEN
    CREATE POLICY "drivers_select_own" ON public.drivers
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
