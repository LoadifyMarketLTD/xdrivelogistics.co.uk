BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.job_bids
    WHERE company_id IS NOT NULL
      AND status IN ('submitted', 'accepted')
    GROUP BY job_id, company_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Active duplicate company bids detected; resolve duplicates before creating job_bids_active_company_unique_idx.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.job_bids
    WHERE company_id IS NULL
      AND status IN ('submitted', 'accepted')
    GROUP BY job_id, bidder_user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Active duplicate null-company bids detected; resolve duplicates before creating job_bids_active_null_company_unique_idx.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS job_bids_active_company_unique_idx
  ON public.job_bids (job_id, company_id)
  WHERE company_id IS NOT NULL
    AND status IN ('submitted', 'accepted');

CREATE UNIQUE INDEX IF NOT EXISTS job_bids_active_null_company_unique_idx
  ON public.job_bids (job_id, bidder_user_id)
  WHERE company_id IS NULL
    AND status IN ('submitted', 'accepted');

COMMIT;
