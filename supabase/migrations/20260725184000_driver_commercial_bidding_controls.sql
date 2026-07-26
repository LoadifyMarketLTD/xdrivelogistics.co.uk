-- Commercial bidding eligibility hardening for driver accounts.
-- Renamed from 20260725183000 to avoid timestamp conflict with
-- 20260725183000_job_bids_active_quote_uniqueness.sql which was applied first.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS driver_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drivers_driver_type_check'
      AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_driver_type_check
      CHECK (driver_type IN ('individual_driver', 'owner_driver', 'subcontractor', 'company_driver'));
  END IF;
END;
$$;

WITH latest_onboarding AS (
  SELECT DISTINCT ON (oa.user_id)
    oa.user_id,
    oa.account_type
  FROM public.onboarding_applications oa
  WHERE oa.user_id IS NOT NULL
  ORDER BY oa.user_id, oa.updated_at DESC, oa.created_at DESC
)
UPDATE public.drivers d
SET driver_type = CASE
  WHEN lo.account_type = 'individual_driver' THEN 'individual_driver'
  WHEN lo.account_type = 'owner_driver' THEN 'owner_driver'
  WHEN lo.account_type = 'subcontractor' THEN 'subcontractor'
  WHEN lo.account_type IN ('fleet_courier', 'company_driver') THEN 'company_driver'
  ELSE CASE
    WHEN d.company_id IS NULL THEN 'individual_driver'
    ELSE 'company_driver'
  END
END
FROM latest_onboarding lo
WHERE lo.user_id = d.user_id
  AND (
    d.driver_type IS NULL
    OR d.driver_type NOT IN ('individual_driver', 'owner_driver', 'subcontractor', 'company_driver')
  );

UPDATE public.drivers d
SET driver_type = CASE
  WHEN d.company_id IS NULL THEN 'individual_driver'
  ELSE 'company_driver'
END
WHERE d.driver_type IS NULL
   OR d.driver_type NOT IN ('individual_driver', 'owner_driver', 'subcontractor', 'company_driver');

ALTER TABLE public.drivers
  ALTER COLUMN driver_type SET DEFAULT 'company_driver';

ALTER TABLE public.drivers
  ALTER COLUMN driver_type SET NOT NULL;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS can_commercial_bid boolean NOT NULL DEFAULT false;

UPDATE public.drivers
SET can_commercial_bid = true
WHERE driver_type IN ('individual_driver', 'owner_driver', 'subcontractor');

-- Broader uniqueness index for active bids — only canonical statuses that the
-- DB constraint actually permits: submitted | accepted.
CREATE UNIQUE INDEX IF NOT EXISTS job_bids_active_company_unique_idx
  ON public.job_bids (job_id, company_id)
  WHERE company_id IS NOT NULL AND status IN ('submitted', 'accepted');

-- Prevent duplicate active bids for individual drivers (no company_id).
CREATE UNIQUE INDEX IF NOT EXISTS job_bids_active_null_company_unique_idx
  ON public.job_bids (job_id, bidder_user_id)
  WHERE company_id IS NULL AND status IN ('submitted', 'accepted');

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND EXISTS (
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

NOTIFY pgrst, 'reload schema';
