-- PROPOSAL ONLY. NOT DEPLOYED. Requires database review and staging test.
-- Prevent bid withdrawal (or any transition away from submitted) while a
-- carrier booking offer is awaiting a decision. Existing stale offers remain untouched.
-- A BEFORE UPDATE trigger checks the committed/pending offer under the bid
-- row lock already held by UPDATE. Award flow must lock the bid row FOR UPDATE.
BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_pending_booking_offer_bid_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status::text = 'submitted'
     AND NEW.status::text <> 'submitted'
     AND EXISTS (
       SELECT 1
       FROM public.job_booking_offers offer
       WHERE offer.bid_id = OLD.id AND offer.status = 'pending'
     )
  THEN
    RAISE EXCEPTION 'A pending booking offer must be answered before changing its quotation status.'
      USING ERRCODE = '23514',
            HINT = 'Respond to the carrier booking offer before withdrawing or changing the quotation.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_pending_booking_offer_bid_status_change ON public.job_bids;
CREATE TRIGGER trg_prevent_pending_booking_offer_bid_status_change
BEFORE UPDATE OF status ON public.job_bids
FOR EACH ROW
EXECUTE FUNCTION public.prevent_pending_booking_offer_bid_status_change();

COMMIT;