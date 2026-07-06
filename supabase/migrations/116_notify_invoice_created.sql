-- P1-008: emit launch-critical invoice_created notification event.

CREATE OR REPLACE FUNCTION public.fn_notify_invoice_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_events (event_type, entity_type, entity_id, company_id, payload)
  VALUES (
    'invoice_created',
    'invoice',
    NEW.id,
    NEW.company_id,
    jsonb_build_object(
      'invoice_id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'company_id', NEW.company_id,
      'job_id', NEW.job_id,
      'client_email', NEW.client_email,
      'amount', COALESCE(NEW.amount, NEW.net_amount)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_invoice_created ON public.invoices;
CREATE TRIGGER trg_notify_invoice_created
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_invoice_created();
