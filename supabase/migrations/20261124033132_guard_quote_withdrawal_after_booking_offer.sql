-- Protect the quotation decision from concurrent buyer awards.
-- A withdrawn quote must never coexist with a pending booking offer for that bid.
-- This trigger runs under the same row lock as the buyer's atomic award RPC.
CREATE OR REPLACE FUNCTION public.guard_quote_withdrawal_after_booking_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'withdrawn' THEN
    IF EXISTS (
      SELECT 1 FROM public.job_booking_offers o
      WHERE o.bid_id = OLD.id AND o.status = 'pending'
    ) OR EXISTS (
      SELECT 1 FROM public.job_commercial_agreements a
      WHERE a.bid_id = OLD.id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'This quotation already has an active booking offer or confirmed commercial agreement. Use the booking workflow.';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_quote_withdrawal_after_booking_offer ON public.job_bids;
CREATE TRIGGER trg_guard_quote_withdrawal_after_booking_offer
BEFORE UPDATE OF status ON public.job_bids
FOR EACH ROW EXECUTE FUNCTION public.guard_quote_withdrawal_after_booking_offer();
