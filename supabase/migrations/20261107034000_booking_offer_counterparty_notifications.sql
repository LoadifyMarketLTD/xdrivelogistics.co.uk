-- Draft only. DO NOT apply directly to production without migration review and staging QA.
-- SECURITY INVOKER runs with the privileges of the application-owned offer writer.
-- The trigger owner must have notifications INSERT permission; test before release.
-- Keep commercial booking acceptance observable to BOTH counterparties.
CREATE OR REPLACE FUNCTION public.fn_notify_booking_offer_counterparties()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.status='pending' THEN
    -- An offer to a named driver must reach that user; the company decision
    -- makers can also accept/decline on behalf of their carrier company.
    INSERT INTO public.notifications(user_id,company_id,title,body,type)
    SELECT DISTINCT recipients.user_id,NEW.carrier_company_id,
      'Booking offer requires your response',
      'A transport buyer has sent a booking offer (' || NEW.id::text || '). Open Bookings to review and respond.',
      'booking_offer_pending'
    FROM (
      SELECT NEW.bidder_user_id AS user_id
      UNION
      SELECT d.user_id FROM public.drivers d WHERE d.id=NEW.bidder_driver_id
      UNION
      SELECT cm.user_id FROM public.company_memberships cm
        WHERE cm.company_id=NEW.carrier_company_id
          AND cm.status::text='active'
          AND cm.role_in_company::text IN ('owner','admin','dispatcher')
    ) recipients
    WHERE recipients.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=recipients.user_id
        AND n.company_id=NEW.carrier_company_id AND n.type='booking_offer_pending'
        AND n.body LIKE '%' || NEW.id::text || '%');
  ELSIF TG_OP='UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status IN ('accepted','declined') THEN
    -- The buyer sees the carrier's decision in their Notifications inbox.
    INSERT INTO public.notifications(user_id,company_id,title,body,type)
    SELECT DISTINCT cm.user_id,NEW.buyer_company_id,
      CASE WHEN NEW.status='accepted' THEN 'Carrier accepted your booking'
           ELSE 'Carrier declined your booking' END,
      CASE WHEN NEW.status='accepted'
           THEN 'Your transport booking (' || NEW.id::text || ') is confirmed. Open Bookings for the assigned transport details.'
           ELSE 'The selected carrier declined your booking offer (' || NEW.id::text || '). Open Quotes to review alternatives.' END,
      CASE WHEN NEW.status='accepted' THEN 'booking_offer_accepted'
           ELSE 'booking_offer_declined' END
    FROM public.company_memberships cm
    WHERE cm.company_id=NEW.buyer_company_id
      AND cm.status::text='active'
      AND cm.role_in_company::text IN ('owner','admin','dispatcher')
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=cm.user_id
        AND n.company_id=NEW.buyer_company_id
        AND n.type=CASE WHEN NEW.status='accepted' THEN 'booking_offer_accepted' ELSE 'booking_offer_declined' END
        AND n.body LIKE '%' || NEW.id::text || '%');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notify_booking_offer_counterparties() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_booking_offer_counterparties ON public.job_booking_offers;
CREATE TRIGGER trg_notify_booking_offer_counterparties
AFTER INSERT OR UPDATE OF status ON public.job_booking_offers
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_booking_offer_counterparties();
