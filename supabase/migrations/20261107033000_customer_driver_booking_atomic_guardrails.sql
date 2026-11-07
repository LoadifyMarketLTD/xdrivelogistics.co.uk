-- Customer <> Driver booking invariant enforcement.
-- Reviewed against production RPCs but not applied to production in this session.
-- API preflights alone cannot prevent concurrent changes; row locks here close the gap.
CREATE OR REPLACE FUNCTION public.fn_guard_booking_offer_schedule_vehicle()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  j public.jobs%ROWTYPE;
  b public.job_bids%ROWTYPE;
  v public.vehicles%ROWTYPE;
  cap integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('pending', 'accepted') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Only pending booking offers may be accepted.';
  END IF;

  SELECT * INTO j FROM public.jobs WHERE id = NEW.job_id FOR UPDATE;
  SELECT * INTO b FROM public.job_bids WHERE id = NEW.bid_id FOR UPDATE;
  IF j.id IS NULL OR b.id IS NULL OR b.job_id IS DISTINCT FROM j.id THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Booking offer references invalid load or quotation.';
  END IF;
  IF j.pickup_datetime IS NULL OR j.pickup_datetime <= now() THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Collection date has passed; reschedule before booking acceptance.';
  END IF;
  IF j.delivery_datetime IS NOT NULL AND j.delivery_datetime < j.pickup_datetime THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Delivery cannot precede collection.';
  END IF;

  IF b.bidder_driver_id IS NOT NULL THEN
    IF NEW.bidder_driver_id IS DISTINCT FROM b.bidder_driver_id
      OR NEW.quoted_vehicle_id IS NULL
      OR NEW.quoted_vehicle_id IS DISTINCT FROM b.quote_vehicle_id THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Named-driver booking must preserve the exact quoted driver and vehicle.';
    END IF;
    SELECT * INTO v FROM public.vehicles WHERE id = NEW.quoted_vehicle_id FOR UPDATE;
    IF v.id IS NULL OR v.company_id IS DISTINCT FROM NEW.carrier_company_id
      OR v.assigned_driver_id IS DISTINCT FROM NEW.bidder_driver_id
      OR COALESCE(v.status::text,'') <> 'active' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Quoted vehicle is inactive or does not belong to the quoted driver and carrier.';
    END IF;
    cap := LEAST(NULLIF(v.pallets_capacity,0), NULLIF(b.quote_vehicle_max_pallets,0));
    IF COALESCE(j.pallets,0) > 0 AND (cap IS NULL OR j.pallets > cap) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Quoted vehicle does not have sufficient verified pallet capacity.';
    END IF;
    IF (COALESCE(j.collection_tail_lift_required,false) OR COALESCE(j.delivery_tail_lift_required,false))
       AND COALESCE(v.has_tail_lift,false) IS NOT TRUE THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='A tail-lift is required for this job.';
    END IF;
  END IF;
  -- Company/Carrier quotations without a named driver can accept the
  -- commercial agreement and subsequently allocate a verified driver/vehicle.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_booking_offer_schedule_vehicle ON public.job_booking_offers;
CREATE TRIGGER trg_guard_booking_offer_schedule_vehicle
BEFORE INSERT OR UPDATE OF status ON public.job_booking_offers
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_booking_offer_schedule_vehicle();

-- A submitted quote cannot be silently rejected or withdrawn while its
-- booking offer is still pending; decline/resolve the offer first.
CREATE OR REPLACE FUNCTION public.fn_guard_pending_booking_quote_withdrawal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status IN ('withdrawn', 'rejected')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND EXISTS (SELECT 1 FROM public.job_booking_offers o
                 WHERE o.bid_id=OLD.id AND o.status='pending') THEN
    RAISE EXCEPTION USING ERRCODE='23514',
      MESSAGE='Resolve the pending carrier booking offer before withdrawing or rejecting this quotation.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_pending_booking_quote_withdrawal ON public.job_bids;
CREATE TRIGGER trg_guard_pending_booking_quote_withdrawal
BEFORE UPDATE OF status ON public.job_bids
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_pending_booking_quote_withdrawal();
