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

-- The restrictive SELECT policy intentionally hides the full jobs row from
-- competing members. Quote submission still needs an eligibility answer without
-- exposing execution columns, so provide only this boolean predicate. The actual
-- job_bids INSERT authorization is owned by the later canonical driver-quote gate
-- migration and is deliberately not duplicated here.
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

COMMENT ON POLICY jobs_preaward_marketplace_privacy_guard ON public.jobs IS
  'Restrictive guard: competing authenticated members cannot SELECT full posted/quoted Marketplace job rows before award; use quote-safe server projections.';
COMMENT ON FUNCTION public.can_read_marketplace_execution_job(uuid) IS
  'Allows full execution-row visibility only outside pre-award Marketplace or to the job creator/owning-company active members; platform/service administration must use server-side privileged boundaries.';
COMMENT ON FUNCTION public.can_quote_marketplace_job(uuid, uuid) IS
  'Returns Marketplace quote eligibility without exposing private execution columns from jobs.';

COMMIT;
