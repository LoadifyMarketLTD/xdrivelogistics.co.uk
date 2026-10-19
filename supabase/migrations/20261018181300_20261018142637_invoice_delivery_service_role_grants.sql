-- PR680 invoice-delivery worker uses supabaseAdmin/service_role through PostgREST.
-- Keep the grants minimal to the tables and operations required by the worker.
GRANT SELECT, UPDATE ON TABLE public.invoices TO service_role;
GRANT SELECT ON TABLE public.companies TO service_role;
GRANT SELECT ON TABLE public.company_settings TO service_role;
