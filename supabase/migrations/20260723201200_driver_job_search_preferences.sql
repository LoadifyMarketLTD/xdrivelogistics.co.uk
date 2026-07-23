-- Driver job search preferences for Inbox / Saved / Deleted.

BEGIN;

CREATE TABLE IF NOT EXISTS public.driver_job_search_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('saved', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, job_id)
);

CREATE INDEX IF NOT EXISTS driver_job_search_preferences_driver_idx
  ON public.driver_job_search_preferences(driver_id, state);

ALTER TABLE public.driver_job_search_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'driver_job_search_preferences'
      AND policyname = 'driver_job_search_preferences_own_select'
  ) THEN
    CREATE POLICY driver_job_search_preferences_own_select
    ON public.driver_job_search_preferences FOR SELECT
    TO authenticated
    USING (
      driver_id = (
        SELECT id FROM public.drivers
        WHERE user_id = auth.uid() AND app_access = true
        LIMIT 1
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'driver_job_search_preferences'
      AND policyname = 'driver_job_search_preferences_own_insert'
  ) THEN
    CREATE POLICY driver_job_search_preferences_own_insert
    ON public.driver_job_search_preferences FOR INSERT
    TO authenticated
    WITH CHECK (
      driver_id = (
        SELECT id FROM public.drivers
        WHERE user_id = auth.uid() AND app_access = true
        LIMIT 1
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'driver_job_search_preferences'
      AND policyname = 'driver_job_search_preferences_own_update'
  ) THEN
    CREATE POLICY driver_job_search_preferences_own_update
    ON public.driver_job_search_preferences FOR UPDATE
    TO authenticated
    USING (
      driver_id = (
        SELECT id FROM public.drivers
        WHERE user_id = auth.uid() AND app_access = true
        LIMIT 1
      )
    )
    WITH CHECK (
      driver_id = (
        SELECT id FROM public.drivers
        WHERE user_id = auth.uid() AND app_access = true
        LIMIT 1
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'driver_job_search_preferences'
      AND policyname = 'driver_job_search_preferences_own_delete'
  ) THEN
    CREATE POLICY driver_job_search_preferences_own_delete
    ON public.driver_job_search_preferences FOR DELETE
    TO authenticated
    USING (
      driver_id = (
        SELECT id FROM public.drivers
        WHERE user_id = auth.uid() AND app_access = true
        LIMIT 1
      )
    );
  END IF;
END $$;

COMMIT;
