-- Close the remaining raw pre-award jobs SELECT bypasses.
--
-- Approved Marketplace browsing already flows through server-side quote-safe
-- projections for Web, Company Marketplace and Driver Mobile/Android. Those
-- projections intentionally retain broad route/commercial/member context while
-- withholding exact execution addresses, private site contacts, private
-- references/instructions and execution evidence until authorised post-award
-- access exists.
--
-- Keep the established post-award/owned-job policies unchanged:
--   - jobs_select_non_driver / owner-company access
--   - jobs_select_assigned_driver / assigned-driver access
--   - jobs_awarded_carrier_select / winning-carrier access
--
-- No lifecycle, role, schema, RPC or business-rule change is introduced here.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Public exchange discovery must use the quote-safe Marketplace API projection,
-- not direct Data API SELECT access to the full jobs row.
DROP POLICY IF EXISTS jobs_exchange_select_policy ON public.jobs;

-- A direct invite is still pre-award. The invited company can discover and bid
-- through the same authorised server projection, but must not gain raw access to
-- execution-only fields before award.
DROP POLICY IF EXISTS jobs_direct_invite_select ON public.jobs;

NOTIFY pgrst, 'reload schema';

COMMIT;
