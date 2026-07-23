-- Follow-up for PR #201 review feedback.
-- Keep rejected drivers out of direct/exchange bid insertion without depending
-- on every environment having a "rejected" enum label, and make invoice
-- notifications safe when invoices.client_email is absent.

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND (
      (
        company_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = job_bids.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.user_id = auth.uid()
          AND d.company_id = job_bids.company_id
          AND COALESCE(d.status::text, '') NOT IN ('suspended', 'inactive', 'rejected')
      )
      OR (
        company_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.role = 'driver'
            AND p.status = 'active'
        )
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_bids.job_id
        AND j.awarded_carrier_company_id IS NULL
        AND (
          j.exchange_visibility <> 'direct'
          OR (
            job_bids.company_id IS NOT NULL
            AND j.direct_invite_company_id = job_bids.company_id
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.fn_notify_invoice_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice jsonb := to_jsonb(NEW);
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
      'client_email', v_invoice->>'client_email',
      'amount', COALESCE(
        NULLIF(v_invoice->>'amount', '')::numeric,
        NULLIF(v_invoice->>'net_amount', '')::numeric
      )
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
