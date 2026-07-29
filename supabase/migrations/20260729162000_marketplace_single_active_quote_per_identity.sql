-- Marketplace fairness: one active quotation per commercial identity per job.
--
-- A fleet/company may submit one active quotation for a job, regardless of whether
-- the action is performed by the owner, dispatcher or an authorised company driver.
-- An independent identity without company_id may also submit only one active quote.
-- Existing duplicate rows are never deleted automatically; the migration fails so
-- they can be reviewed before the uniqueness rule is applied.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT job_id, company_id
    FROM public.job_bids
    WHERE company_id IS NOT NULL
      AND status IN ('submitted', 'accepted')
    GROUP BY job_id, company_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Marketplace fairness preflight failed: a company has multiple active quotations for the same job.';
  END IF;

  IF EXISTS (
    SELECT job_id, bidder_user_id
    FROM public.job_bids
    WHERE company_id IS NULL
      AND status IN ('submitted', 'accepted')
    GROUP BY job_id, bidder_user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Marketplace fairness preflight failed: an independent identity has multiple active quotations for the same job.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS job_bids_one_active_company_quote_per_job_uidx
  ON public.job_bids (job_id, company_id)
  WHERE company_id IS NOT NULL
    AND status IN ('submitted', 'accepted');

CREATE UNIQUE INDEX IF NOT EXISTS job_bids_one_active_independent_quote_per_job_uidx
  ON public.job_bids (job_id, bidder_user_id)
  WHERE company_id IS NULL
    AND status IN ('submitted', 'accepted');

COMMIT;
