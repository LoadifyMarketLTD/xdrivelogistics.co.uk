BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Marketplace execution visibility participates in a RESTRICTIVE jobs SELECT
-- policy. A stale active-membership row must not preserve visibility when the
-- actor profile or tenant company is no longer active.
CREATE OR REPLACE FUNCTION public.can_read_marketplace_execution_job(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT COALESCE((
    SELECT
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
        JOIN public.companies c
          ON c.id = cm.company_id
        JOIN public.profiles p
          ON p.user_id = cm.user_id
        WHERE cm.company_id = j.company_id
          AND cm.user_id = auth.uid()
          AND cm.status::text = 'active'
          AND c.status::text = 'active'
          AND COALESCE(p.status::text, '') = 'active'
      )
    FROM public.jobs j
    WHERE j.id = p_job_id
  ), false);
$function$;

REVOKE ALL ON FUNCTION public.can_read_marketplace_execution_job(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_marketplace_execution_job(uuid)
TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
