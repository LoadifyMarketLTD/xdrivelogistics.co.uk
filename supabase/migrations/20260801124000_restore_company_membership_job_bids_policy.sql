BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drivers'
      AND column_name = 'can_commercial_bid'
  ) THEN
    RAISE EXCEPTION 'drivers.can_commercial_bid must exist before replacing job_bids_exchange_insert.';
  END IF;
END
$$;

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;

CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND (
      (
        job_bids.company_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = job_bids.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.user_id = auth.uid()
          AND d.app_access = true
          AND COALESCE(d.status::text, '') = 'active'
          AND d.can_commercial_bid = true
          AND (
            d.company_id = job_bids.company_id
            OR (d.company_id IS NULL AND job_bids.company_id IS NULL)
          )
      )
      OR (
        job_bids.company_id IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.role = 'driver'
            AND p.status = 'active'
        )
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_bids.job_id
        AND j.status = 'posted'
        AND j.awarded_carrier_company_id IS NULL
        AND (
          j.exchange_visibility = 'exchange'
          OR (
            j.exchange_visibility = 'direct'
            AND job_bids.company_id IS NOT NULL
            AND j.direct_invite_company_id = job_bids.company_id
          )
        )
        AND (job_bids.company_id IS NULL OR j.company_id <> job_bids.company_id)
    )
  );

COMMIT;
