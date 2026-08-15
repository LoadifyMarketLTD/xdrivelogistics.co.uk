BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Marketplace rows contain both quote-safe commercial information and private
-- execution information in the same jobs row. RLS cannot redact columns, so a
-- competing authenticated member must not SELECT that row directly before an
-- authoritative award/allocation. Marketplace clients consume the sanitised
-- server projection instead.

CREATE OR REPLACE FUNCTION public.can_read_marketplace_execution_job(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((
    SELECT
      -- Anything outside the pre-award Marketplace boundary continues through
      -- the existing permissive jobs policies unchanged.
      NOT (
        COALESCE(j.status::text, '') IN ('posted', 'quoted')
        AND j.awarded_carrier_company_id IS NULL
        AND (
          j.exchange_posted_at IS NOT NULL
          OR COALESCE(j.exchange_visibility::text, '') IN ('exchange', 'direct')
        )
      )
      OR j.created_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.company_memberships cm
        WHERE cm.company_id = j.company_id
          AND cm.user_id = auth.uid()
          AND COALESCE(cm.status::text, '') = 'active'
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND COALESCE(p.status::text, '') = 'active'
          AND COALESCE(p.role::text, '') IN ('owner', 'super_admin', 'platform_admin', 'platform_owner')
      )
    FROM public.jobs j
    WHERE j.id = p_job_id
  ), false);
$$;

REVOKE ALL ON FUNCTION public.can_read_marketplace_execution_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_marketplace_execution_job(uuid) TO authenticated;

DROP POLICY IF EXISTS jobs_preaward_marketplace_privacy_guard ON public.jobs;
CREATE POLICY jobs_preaward_marketplace_privacy_guard
  ON public.jobs
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.can_read_marketplace_execution_job(id));

-- Direct job_bids inserts historically validate Marketplace availability with
-- a SELECT from jobs. The restrictive policy above intentionally makes that
-- row invisible to competitors, so preserve the existing quote workflow with
-- a narrowly-scoped SECURITY DEFINER predicate that returns only eligibility.
CREATE OR REPLACE FUNCTION public.can_quote_marketplace_job(
  p_job_id uuid,
  p_bidder_company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = p_job_id
      AND COALESCE(j.status::text, '') IN ('posted', 'quoted')
      AND j.awarded_carrier_company_id IS NULL
      AND (
        j.exchange_visibility = 'exchange'
        OR (
          j.exchange_visibility = 'direct'
          AND p_bidder_company_id IS NOT NULL
          AND j.direct_invite_company_id = p_bidder_company_id
        )
      )
      AND (p_bidder_company_id IS NULL OR j.company_id <> p_bidder_company_id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_quote_marketplace_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_quote_marketplace_job(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  TO authenticated
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
            AND COALESCE(cm.status::text, '') = 'active'
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
            AND COALESCE(p.role::text, '') = 'driver'
            AND COALESCE(p.status::text, '') = 'active'
        )
      )
    )
    AND public.can_quote_marketplace_job(job_bids.job_id, job_bids.company_id)
  );

COMMENT ON POLICY jobs_preaward_marketplace_privacy_guard ON public.jobs IS
  'Restrictive guard: competing authenticated members cannot SELECT full posted/quoted Marketplace job rows before award; use quote-safe server projections.';
COMMENT ON FUNCTION public.can_quote_marketplace_job(uuid, uuid) IS
  'Returns Marketplace quote eligibility without exposing private execution columns from jobs.';

COMMIT;
