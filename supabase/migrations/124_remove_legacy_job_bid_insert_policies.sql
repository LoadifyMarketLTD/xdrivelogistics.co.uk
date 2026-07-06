-- Remove legacy permissive INSERT policies that predate exchange/direct-invite
-- isolation. job_bids_exchange_insert is the canonical INSERT policy because it
-- validates bidder_user_id, active company/driver context, awarded state, and
-- direct_invite_company_id for direct jobs.

DROP POLICY IF EXISTS bids_insert ON public.job_bids;
DROP POLICY IF EXISTS bids_insert_bidder ON public.job_bids;
DROP POLICY IF EXISTS job_bids_insert ON public.job_bids;

NOTIFY pgrst, 'reload schema';
