-- Remove the remote-only legacy assignment trigger that derives job assignment
-- directly from accepted_bid_id.
--
-- Canonical award semantics are owned by accept_job_bid_atomic:
-- - named Driver bid -> same eligible driver + canonical vehicle auto-allocated;
-- - company-only Fleet bid -> awarded/unallocated for dispatcher allocation.
--
-- The legacy trigger is a second mutation path that does not own the canonical
-- compliance/readiness/award checks and depends on the remote-only
-- job_bids.bidder_company_id compatibility column. Fresh PR #357 history does
-- not create it. Removing the trigger makes live/fresh converge on the RPC as
-- the single award/assignment authority without changing approved semantics.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP TRIGGER IF EXISTS trg_sync_job_assignment_from_accepted_bid ON public.jobs;

DO $$
BEGIN
  IF to_regprocedure('public.sync_job_assignment_from_accepted_bid()') IS NOT NULL THEN
    COMMENT ON FUNCTION public.sync_job_assignment_from_accepted_bid() IS
      'Legacy compatibility function retained for history only. Its jobs trigger is disabled; canonical award and named-driver/company-only assignment semantics are owned by accept_job_bid_atomic.';
  END IF;
END
$$;

COMMIT;
