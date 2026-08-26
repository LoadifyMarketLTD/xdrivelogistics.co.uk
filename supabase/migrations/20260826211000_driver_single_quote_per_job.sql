-- Canonical driver quote invariant:
-- one named driver may submit only one quote for a given job, regardless of
-- whether that quote later becomes submitted, accepted, rejected, withdrawn or expired.
-- Network retries of the same logical quote are handled idempotently by the API
-- and must not create a second job_bids row.

DO $$
BEGIN
  IF EXISTS (
    WITH duplicate_groups AS (
      SELECT job_id, bidder_driver_id
      FROM public.job_bids
      WHERE bidder_driver_id IS NOT NULL
      GROUP BY job_id, bidder_driver_id
      HAVING COUNT(*) > 1
    ), referenced AS (
      SELECT
        jb.job_id,
        jb.bidder_driver_id,
        COUNT(*) FILTER (
          WHERE EXISTS (SELECT 1 FROM public.jobs j WHERE j.accepted_bid_id = jb.id)
             OR EXISTS (SELECT 1 FROM public.job_commercial_agreements a WHERE a.bid_id = jb.id)
        ) AS referenced_count
      FROM public.job_bids jb
      JOIN duplicate_groups dg
        ON dg.job_id = jb.job_id
       AND dg.bidder_driver_id = jb.bidder_driver_id
      GROUP BY jb.job_id, jb.bidder_driver_id
    )
    SELECT 1 FROM referenced WHERE referenced_count > 1
  ) THEN
    RAISE EXCEPTION 'Cannot safely deduplicate job_bids: more than one referenced bid exists for a driver/job pair';
  END IF;
END
$$;

-- Prefer the bid already referenced by execution/commercial records. If no bid
-- is referenced, keep the earliest quote and remove later duplicate test rows.
WITH ranked AS (
  SELECT
    jb.id,
    ROW_NUMBER() OVER (
      PARTITION BY jb.job_id, jb.bidder_driver_id
      ORDER BY
        (
          EXISTS (SELECT 1 FROM public.jobs j WHERE j.accepted_bid_id = jb.id)
          OR EXISTS (SELECT 1 FROM public.job_commercial_agreements a WHERE a.bid_id = jb.id)
        ) DESC,
        jb.created_at ASC,
        jb.id ASC
    ) AS rn
  FROM public.job_bids jb
  WHERE jb.bidder_driver_id IS NOT NULL
), removable AS (
  SELECT r.id
  FROM ranked r
  WHERE r.rn > 1
    AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.accepted_bid_id = r.id)
    AND NOT EXISTS (SELECT 1 FROM public.job_commercial_agreements a WHERE a.bid_id = r.id)
)
DELETE FROM public.job_bids jb
USING removable r
WHERE jb.id = r.id;

-- Independent identities without a driver row are also one quote per user/job.
WITH ranked AS (
  SELECT
    jb.id,
    ROW_NUMBER() OVER (
      PARTITION BY jb.job_id, jb.bidder_user_id
      ORDER BY jb.created_at ASC, jb.id ASC
    ) AS rn
  FROM public.job_bids jb
  WHERE jb.bidder_driver_id IS NULL
    AND jb.bidder_user_id IS NOT NULL
)
DELETE FROM public.job_bids jb
USING ranked r
WHERE jb.id = r.id
  AND r.rn > 1
  AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.accepted_bid_id = jb.id)
  AND NOT EXISTS (SELECT 1 FROM public.job_commercial_agreements a WHERE a.bid_id = jb.id);

CREATE UNIQUE INDEX IF NOT EXISTS job_bids_one_quote_per_driver_job_uidx
  ON public.job_bids (job_id, bidder_driver_id)
  WHERE bidder_driver_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_bids_one_quote_per_user_job_uidx
  ON public.job_bids (job_id, bidder_user_id)
  WHERE bidder_driver_id IS NULL
    AND bidder_user_id IS NOT NULL;
