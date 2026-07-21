-- Source-of-truth for the admin bids view dependency.
--
-- The canonical exchange model is job-based: public.job_bids.job_id references
-- public.jobs.id. Some production-era objects exposed additional legacy aliases
-- such as load_id, bidder_company_id and quote_amount. Preserve the view's API
-- shape by deriving those aliases from canonical columns instead of requiring
-- legacy physical columns on a clean database.

DROP VIEW IF EXISTS public.job_bids_with_job_owner;

CREATE VIEW public.job_bids_with_job_owner
WITH (security_invoker = true)
AS
SELECT
  jb.id,
  jb.job_id,
  jb.bidder_id,
  jb.bid_price_gbp,
  jb.message,
  jb.created_at,
  jb.company_id AS bidder_company_id,
  COALESCE(jb.bid_price_gbp, jb.amount) AS quote_amount,
  jb.status AS bid_status,
  NULL::uuid AS load_id,
  jb.bidder_user_id,
  jb.currency,
  COALESCE(jb.bid_price_gbp, jb.amount) AS amount_gbp,
  jb.amount,
  jb.created_at AS updated_at,
  jb.bidder_driver_id,
  j.company_id AS owner_company_id,
  j.exchange_visibility,
  j.status::text AS job_status,
  NULL::text AS load_status,
  j.pickup_location,
  j.delivery_location,
  j.pickup_datetime,
  j.vehicle_type,
  j.awarded_carrier_company_id
FROM public.job_bids jb
JOIN public.jobs j ON j.id = jb.job_id;

GRANT SELECT ON public.job_bids_with_job_owner TO authenticated;
GRANT SELECT ON public.job_bids_with_job_owner TO service_role;

NOTIFY pgrst, 'reload schema';
