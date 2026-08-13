-- Scope driver job visibility to public Exchange work or an explicit job relationship.
--
-- Production currently has a legacy permissive SELECT policy named
-- drivers_select_all_jobs. Because PostgreSQL permissive RLS policies are ORed,
-- that policy lets any active/app-enabled driver satisfy SELECT for every jobs row,
-- bypassing the narrower direct-invite, assignment and awarded-carrier policies.
--
-- Canonical XDrive contract:
--   * eligible drivers may discover public Exchange jobs while they are open for quoting;
--   * private/direct jobs remain relationship-scoped;
--   * awarded/allocated jobs remain assignment/carrier scoped.
--
-- This migration deliberately does not change platform/owner semantics. The legacy
-- jobs_select_owner/is_owner boundary is a separate tenancy review and must not be
-- mixed into the driver Exchange fix.

BEGIN;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Remove only the policy that grants a driver blanket read access to every job.
DROP POLICY IF EXISTS drivers_select_all_jobs ON public.jobs;

-- Re-declare the public Exchange policy here instead of depending on production-only
-- policy drift. This keeps a clean migration chain self-contained and also preserves
-- visibility after the blanket driver policy is removed.
DROP POLICY IF EXISTS jobs_exchange_select_policy ON public.jobs;
CREATE POLICY jobs_exchange_select_policy
ON public.jobs
FOR SELECT
TO authenticated
USING (
  jobs.exchange_visibility = 'exchange'
  AND lower(coalesce(jobs.status::text, '')) IN ('posted', 'quoted')
  AND (
    -- Fleet Driver / Owner Driver with an active driver record.
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.user_id = auth.uid()
        AND coalesce(d.app_access, true) = true
        AND lower(coalesce(d.status::text, 'active')) NOT IN ('suspended', 'inactive', 'rejected')
    )
    OR
    -- Eligible fleet/company operational users. Owner Driver is also preserved when
    -- commercial ownership exists without requiring a separate drivers row.
    EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
        AND coalesce(cm.status, '') = 'active'
        AND cm.role_in_company = ANY (
          ARRAY['owner', 'admin', 'dispatcher', 'member', 'viewer']::text[]
        )
    )
    OR
    -- Preserve the existing public Exchange access contract for broker/owner profiles;
    -- this branch is still constrained to public posted/quoted Exchange rows only.
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = ANY (ARRAY['owner', 'broker']::text[])
    )
  )
);

-- Do not drop or broaden the relationship policies here:
--   jobs_direct_invite_select
--   jobs_driver_assigned_or_awarded_v1
-- They remain responsible for direct/private and post-award visibility respectively.

COMMIT;
