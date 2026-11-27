-- PR #849: the booking offer insertion must lock the quote row.
-- All official awards already lock this bid first; this also guards privileged direct inserts.
CREATE OR REPLACE FUNCTION public.guard_pending_booking_offer_quote_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote_status text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT b.status INTO v_quote_status
    FROM public.job_bids b
    WHERE b.id = NEW.bid_id
    FOR UPDATE;
    IF NOT FOUND OR v_quote_status IS DISTINCT FROM 'submitted' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'This quotation was withdrawn or is no longer submitted. A booking offer cannot be issued.';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS trg_guard_pending_booking_offer_quote_state ON public.job_booking_offers;
CREATE TRIGGER trg_guard_pending_booking_offer_quote_state
BEFORE INSERT ON public.job_booking_offers
FOR EACH ROW EXECUTE FUNCTION public.guard_pending_booking_offer_quote_state();
