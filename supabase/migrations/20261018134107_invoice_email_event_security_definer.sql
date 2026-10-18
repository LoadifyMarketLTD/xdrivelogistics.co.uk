-- PR680: signed Resend webhooks are processed only by the server-side service_role.
-- Own protected invoice/outbox writes inside the RPC and pin the search path.
ALTER FUNCTION public.apply_invoice_email_event(text, text, text, timestamptz, text)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.apply_invoice_email_event(text, text, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_invoice_email_event(text, text, text, timestamptz, text)
  TO service_role;
