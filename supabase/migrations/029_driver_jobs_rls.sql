-- 029_driver_jobs_rls.sql
-- Allow drivers to read and update only their own assigned jobs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_select_assigned_driver'
  ) THEN
    CREATE POLICY "jobs_select_assigned_driver" ON public.jobs
      FOR SELECT
      USING (
        assigned_driver_id = (
          SELECT id
          FROM public.drivers
          WHERE user_id = auth.uid()
          LIMIT 1
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_update_assigned_driver'
  ) THEN
    CREATE POLICY "jobs_update_assigned_driver" ON public.jobs
      FOR UPDATE
      USING (
        assigned_driver_id = (
          SELECT id
          FROM public.drivers
          WHERE user_id = auth.uid()
          LIMIT 1
        )
      )
      WITH CHECK (
        assigned_driver_id = (
          SELECT id
          FROM public.drivers
          WHERE user_id = auth.uid()
          LIMIT 1
        )
      );
  END IF;
END $$;
