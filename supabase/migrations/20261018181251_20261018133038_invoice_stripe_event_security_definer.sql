-- PR680: webhook settlement runs only through the server-side service_role.
-- The function must own its writes to protected finance tables while keeping a fixed search_path.
ALTER FUNCTION public.apply_invoice_stripe_event(jsonb, boolean)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.apply_invoice_stripe_event(jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_invoice_stripe_event(jsonb, boolean)
  TO service_role;
