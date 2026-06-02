-- Migration 072: Canonicalize jobs distance miles field
-- Canonical field: public.jobs.job_distance_miles
-- Keeps optional legacy alias public.jobs.distance_miles synchronized when present.

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_distance_miles numeric;

DO $$
DECLARE
  has_legacy_distance_column boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'distance_miles'
  )
  INTO has_legacy_distance_column;

  IF has_legacy_distance_column THEN
    -- One-time data alignment in both directions.
    EXECUTE $sync_data$
      UPDATE public.jobs
      SET
        job_distance_miles = COALESCE(job_distance_miles, distance_miles),
        distance_miles = COALESCE(job_distance_miles, distance_miles)
      WHERE
        job_distance_miles IS DISTINCT FROM COALESCE(job_distance_miles, distance_miles)
        OR distance_miles IS DISTINCT FROM COALESCE(job_distance_miles, distance_miles);
    $sync_data$;

    EXECUTE $sync_fn$
      CREATE OR REPLACE FUNCTION public.fn_sync_jobs_distance_miles_alias()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SET search_path = public
      AS $fn$
      BEGIN
        -- Backward compatibility: if only legacy alias changed, mirror into canonical.
        IF TG_OP = 'UPDATE'
           AND NEW.distance_miles IS DISTINCT FROM OLD.distance_miles
           AND NOT (NEW.job_distance_miles IS DISTINCT FROM OLD.job_distance_miles)
        THEN
          NEW.job_distance_miles := NEW.distance_miles;
        END IF;

        -- Canonical value always stored in job_distance_miles.
        IF NEW.job_distance_miles IS NULL THEN
          NEW.job_distance_miles := NEW.distance_miles;
        END IF;

        -- Keep alias synchronized for legacy readers/writers.
        NEW.distance_miles := NEW.job_distance_miles;

        RETURN NEW;
      END;
      $fn$;
    $sync_fn$;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_jobs_distance_miles_alias ON public.jobs';
    EXECUTE '
      CREATE TRIGGER trg_sync_jobs_distance_miles_alias
      BEFORE INSERT OR UPDATE OF job_distance_miles, distance_miles ON public.jobs
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_sync_jobs_distance_miles_alias()
    ';
  ELSE
    -- No legacy alias column in this environment.
    DROP TRIGGER IF EXISTS trg_sync_jobs_distance_miles_alias ON public.jobs;
    DROP FUNCTION IF EXISTS public.fn_sync_jobs_distance_miles_alias();
  END IF;
END
$$;

COMMIT;
