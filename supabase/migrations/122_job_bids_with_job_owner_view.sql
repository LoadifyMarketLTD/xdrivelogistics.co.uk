-- Source-of-truth for the admin bids view dependency.
--
-- Production may still expose the legacy job_bids.load_id -> loads relationship,
-- while clean installations use job_bids.job_id as the canonical relationship.
-- Build the same stable view shape in both environments without requiring the
-- legacy column to exist.

DROP VIEW IF EXISTS public.job_bids_with_job_owner;

DO $$
BEGIN
  IF to_regclass('public.loads') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'job_bids'
         AND column_name = 'load_id'
     ) THEN
    EXECUTE $view$
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
        j.status::text AS job_status,
        l.status::text AS load_status,
        j.pickup_location,
        j.delivery_location,
        j.pickup_datetime,
        j.vehicle_type,
        j.awarded_carrier_company_id
      FROM public.job_bids jb
      JOIN public.jobs j ON j.id = jb.job_id
      LEFT JOIN public.loads l ON l.id = jb.load_id
    $view$;
  ELSE
    EXECUTE $view$
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
        jb.bidder_company_id,
        jb.quote_amount,
        jb.status AS bid_status,
        NULL::uuid AS load_id,
        jb.bidder_user_id,
        jb.currency,
        jb.amount_gbp,
        jb.amount,
        jb.updated_at,
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
      JOIN public.jobs j ON j.id = jb.job_id
    $view$;
  END IF;
END
$$;

GRANT SELECT ON public.job_bids_with_job_owner TO authenticated;
GRANT SELECT ON public.job_bids_with_job_owner TO service_role;

NOTIFY pgrst, 'reload schema';
