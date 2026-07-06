-- Source-of-truth for the admin bids view dependency.
--
-- Production already has public.job_bids_with_job_owner, but the object was
-- missing from repo migrations. Recreate it forward-only so clean environments
-- and migration replays have the same object the app queries.

CREATE OR REPLACE VIEW public.job_bids_with_job_owner
WITH (security_invoker = true)
AS
SELECT
  jb.id,
  jb.job_id,
  jb.bidder_id,
  jb.bid_price_gbp,
  jb.message,
  jb.created_at,
  jb.bidder_company_id,
  jb.quote_amount,
  jb.status AS bid_status,
  jb.load_id,
  jb.bidder_user_id,
  jb.currency,
  jb.amount_gbp,
  jb.amount,
  jb.updated_at,
  jb.bidder_driver_id,
  COALESCE(l.company_id, j.company_id) AS owner_company_id,
  j.exchange_visibility,
  j.status AS job_status,
  l.status AS load_status,
  j.pickup_location,
  j.delivery_location,
  j.pickup_datetime,
  j.vehicle_type,
  j.awarded_carrier_company_id
FROM public.job_bids jb
JOIN public.jobs j ON j.id = jb.job_id
LEFT JOIN public.loads l ON l.id = jb.load_id;

GRANT SELECT ON public.job_bids_with_job_owner TO authenticated;
GRANT SELECT ON public.job_bids_with_job_owner TO service_role;

NOTIFY pgrst, 'reload schema';
