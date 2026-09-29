BEGIN;

ALTER TABLE public.job_booking_offers
  ADD COLUMN IF NOT EXISTS payment_obligation_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_obligation_acknowledged_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payment_obligation_terms_version text;

COMMENT ON COLUMN public.job_booking_offers.payment_obligation_acknowledged_at IS
  'Timestamp when the transport buyer explicitly acknowledged responsibility to pay the awarded carrier.';
COMMENT ON COLUMN public.job_booking_offers.payment_obligation_acknowledged_by IS
  'Authenticated buyer-side user who explicitly acknowledged the payment obligation.';
COMMENT ON COLUMN public.job_booking_offers.payment_obligation_terms_version IS
  'Server-controlled version of the payment-obligation wording acknowledged for this booking offer.';

ALTER TABLE public.job_booking_offers
  DROP CONSTRAINT IF EXISTS job_booking_offers_payment_ack_complete;
ALTER TABLE public.job_booking_offers
  ADD CONSTRAINT job_booking_offers_payment_ack_complete CHECK (
    (payment_obligation_acknowledged_at IS NULL AND payment_obligation_acknowledged_by IS NULL AND payment_obligation_terms_version IS NULL)
    OR
    (payment_obligation_acknowledged_at IS NOT NULL AND payment_obligation_acknowledged_by IS NOT NULL AND NULLIF(btrim(payment_obligation_terms_version),'') IS NOT NULL)
  );

DROP FUNCTION IF EXISTS public.award_job_bid_pending_atomic(uuid,uuid);
CREATE OR REPLACE FUNCTION public.award_job_bid_pending_atomic(
  p_bid_id uuid,
  p_actor_user_id uuid,
  p_payment_obligation_acknowledged boolean,
  p_payment_obligation_terms_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), p_actor_user_id);
  v_job public.jobs%ROWTYPE;
  v_bid public.job_bids%ROWTYPE;
  v_supplier_company_id uuid;
  v_driver public.drivers%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_offer_id uuid;
  v_amount numeric(12,2);
  v_issues text[];
  v_requested_type text;
  v_has_mot boolean;
  v_has_insurance boolean;
BEGIN
  IF p_bid_id IS NULL OR v_actor IS NULL THEN
    RETURN jsonb_build_object('success',false,'http_status',400,'error_code','BAD_REQUEST','error_message','Bid and actor are required.');
  END IF;
  IF COALESCE(p_payment_obligation_acknowledged,false) IS NOT TRUE
     OR NULLIF(btrim(COALESCE(p_payment_obligation_terms_version,'')),'') IS NULL THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','PAYMENT_OBLIGATION_ACK_REQUIRED','error_message','You must explicitly acknowledge the transport buyer payment obligation before awarding this quote.');
  END IF;

  SELECT * INTO v_bid FROM public.job_bids WHERE id=p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'http_status',404,'error_code','NOT_FOUND','error_message','Bid not found.'); END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id=v_bid.job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'http_status',404,'error_code','NOT_FOUND','error_message','Job not found.'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm JOIN public.companies c ON c.id=cm.company_id
    WHERE cm.company_id=v_job.company_id AND cm.user_id=v_actor AND cm.status::text='active'
      AND cm.role_in_company::text IN ('owner','admin','dispatcher') AND c.status::text='active'
  ) THEN
    RETURN jsonb_build_object('success',false,'http_status',403,'error_code','FORBIDDEN','error_message','Not authorised to award bids for this company.');
  END IF;
  IF COALESCE(v_job.exchange_visibility,'') NOT IN ('exchange','direct') OR COALESCE(v_job.status,'') NOT IN ('posted','quoted') THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','JOB_NOT_AWARDABLE','error_message','Job is no longer awardable.');
  END IF;
  IF COALESCE(v_bid.status,'') <> 'submitted' THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','BID_NOT_SUBMITTED','error_message','Only submitted bids can be awarded.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.job_booking_offers o WHERE o.job_id=v_job.id AND o.status='pending') THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','PENDING_CARRIER_ACCEPTANCE','error_message','A carrier acceptance request is already pending for this job.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.job_commercial_agreements a WHERE a.job_id=v_job.id) THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','CONTRACT_ALREADY_FORMED','error_message','This job already has a commercial agreement.');
  END IF;

  v_supplier_company_id := v_bid.company_id;
  IF v_bid.bidder_driver_id IS NOT NULL THEN
    SELECT * INTO v_driver FROM public.drivers WHERE id=v_bid.bidder_driver_id;
    IF NOT FOUND OR v_driver.user_id IS DISTINCT FROM v_bid.bidder_user_id THEN
      RETURN jsonb_build_object('success',false,'http_status',409,'error_code','DRIVER_IDENTITY_MISMATCH','error_message','Bidder driver identity is invalid.');
    END IF;
    IF v_supplier_company_id IS NULL THEN v_supplier_company_id := v_driver.company_id; END IF;
    IF v_supplier_company_id IS DISTINCT FROM v_driver.company_id THEN
      RETURN jsonb_build_object('success',false,'http_status',409,'error_code','DRIVER_COMPANY_MISMATCH','error_message','Bidder driver does not belong to the bidding company.');
    END IF;
    IF v_bid.quote_vehicle_id IS NULL THEN
      RETURN jsonb_build_object('success',false,'http_status',409,'error_code','QUOTE_VEHICLE_MISSING','error_message','The driver quote does not identify its vehicle.');
    END IF;
    SELECT * INTO v_vehicle FROM public.vehicles
      WHERE id=v_bid.quote_vehicle_id AND assigned_driver_id=v_bid.bidder_driver_id AND COALESCE(status::text,'')='active';
    v_requested_type := COALESCE(NULLIF(v_job.requested_vehicle_type,''),NULLIF(v_job.vehicle_type,''));
    IF NOT FOUND OR NOT public.vehicle_can_cover_requested_type(v_vehicle.type,v_requested_type) THEN
      RETURN jsonb_build_object('success',false,'http_status',409,'error_code','QUOTE_VEHICLE_INVALID','error_message','The quoted vehicle is no longer active or compatible.');
    END IF;
    SELECT EXISTS(SELECT 1 FROM public.vehicle_documents vd WHERE vd.vehicle_id=v_vehicle.id AND lower(COALESCE(vd.status::text,''))='approved' AND (vd.expiry_date IS NULL OR vd.expiry_date>=CURRENT_DATE) AND regexp_replace(lower(COALESCE(vd.doc_type,'')),'[^a-z0-9]+','','g') IN ('mot','vehiclemot','goodsvehicletest')) INTO v_has_mot;
    SELECT EXISTS(SELECT 1 FROM public.vehicle_documents vd WHERE vd.vehicle_id=v_vehicle.id AND lower(COALESCE(vd.status::text,''))='approved' AND (vd.expiry_date IS NULL OR vd.expiry_date>=CURRENT_DATE) AND regexp_replace(lower(COALESCE(vd.doc_type,'')),'[^a-z0-9]+','','g') IN ('insurance','vehicleinsurance','motorfleetinsurance','insurancecertificate')) INTO v_has_insurance;
    IF NOT v_has_mot OR NOT v_has_insurance THEN
      RETURN jsonb_build_object('success',false,'http_status',409,'error_code','QUOTE_VEHICLE_COMPLIANCE_INVALID','error_message','The quoted vehicle must have current MOT and insurance.');
    END IF;
    IF public.vehicle_requires_driver_cpc(v_vehicle.type,v_vehicle.max_weight_kg,COALESCE(v_vehicle.is_zero_emission,false)) AND NOT public.driver_has_valid_cpc(v_bid.bidder_driver_id) THEN
      RETURN jsonb_build_object('success',false,'http_status',409,'error_code','DRIVER_CPC_REQUIRED','error_message','Driver CPC is required for the quoted vehicle.');
    END IF;
  ELSIF v_supplier_company_id IS NULL AND v_bid.bidder_user_id IS NOT NULL THEN
    SELECT d.* INTO v_driver FROM public.drivers d
      WHERE d.user_id=v_bid.bidder_user_id AND COALESCE(d.driver_type,'')='owner_driver'
      ORDER BY d.id LIMIT 1;
    IF FOUND THEN v_supplier_company_id:=v_driver.company_id; END IF;
  END IF;

  IF v_supplier_company_id IS NULL OR v_supplier_company_id=v_job.company_id THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','SUPPLIER_INVALID','error_message','Bid has no valid independent carrier company.');
  END IF;
  v_issues:=public.company_compliance_issues(v_supplier_company_id,'award');
  IF COALESCE(array_length(v_issues,1),0)>0 THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','COMPLIANCE_BLOCKED','error_message',format('Compliance blocked award action: %s',array_to_string(v_issues,' ')));
  END IF;
  v_amount:=COALESCE(v_bid.bid_price_gbp,v_bid.amount)::numeric(12,2);
  IF v_amount IS NULL OR v_amount<=0 THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','INVALID_BID','error_message','Bid has no valid positive price.');
  END IF;

  INSERT INTO public.job_booking_offers(
    job_id,bid_id,buyer_company_id,carrier_company_id,bidder_user_id,bidder_driver_id,quoted_vehicle_id,quoted_amount,currency,offered_by,
    payment_obligation_acknowledged_at,payment_obligation_acknowledged_by,payment_obligation_terms_version
  )
  VALUES(
    v_job.id,v_bid.id,v_job.company_id,v_supplier_company_id,v_bid.bidder_user_id,v_bid.bidder_driver_id,v_bid.quote_vehicle_id,v_amount,
    COALESCE(v_bid.currency,v_job.currency,'GBP'),v_actor,now(),v_actor,btrim(p_payment_obligation_terms_version)
  ) RETURNING id INTO v_offer_id;

  INSERT INTO public.job_tracking_events(job_id,event_type,created_by,message,meta)
  VALUES(v_job.id,'payment_obligation_acknowledged',v_actor,'Transport buyer acknowledged responsibility to pay the awarded carrier.',jsonb_build_object('booking_offer_id',v_offer_id,'bid_id',v_bid.id,'terms_version',btrim(p_payment_obligation_terms_version)));
  INSERT INTO public.job_tracking_events(job_id,event_type,created_by,message,meta)
  VALUES(v_job.id,'booking_offer_created',v_actor,'Carrier acceptance requested after buyer award.',jsonb_build_object('booking_offer_id',v_offer_id,'bid_id',v_bid.id,'carrier_company_id',v_supplier_company_id));

  RETURN jsonb_build_object('ok',true,'success',true,'http_status',200,'booking_offer_id',v_offer_id,'bid_id',v_bid.id,'job_id',v_job.id,'carrier_company_id',v_supplier_company_id,'status','pending_carrier_acceptance');
END;
$$;
REVOKE ALL ON FUNCTION public.award_job_bid_pending_atomic(uuid,uuid,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_job_bid_pending_atomic(uuid,uuid,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.accept_job_booking_offer_atomic(p_offer_id uuid,p_actor_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_actor uuid:=COALESCE(auth.uid(),p_actor_user_id);
  v_offer public.job_booking_offers%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_bid public.job_bids%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
  v_vehicle_id uuid;
  v_driver_eligible boolean;
  v_blockers text[];
  v_issues text[];
  v_agreement_id uuid;
  v_final_status text;
BEGIN
  SELECT * INTO v_offer FROM public.job_booking_offers WHERE id=p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'http_status',404,'error_code','NOT_FOUND','error_message','Booking offer not found.'); END IF;
  IF v_offer.status<>'pending' THEN RETURN jsonb_build_object('success',false,'http_status',409,'error_code','OFFER_NOT_PENDING','error_message','Booking offer is no longer pending.'); END IF;
  IF v_offer.payment_obligation_acknowledged_at IS NULL OR v_offer.payment_obligation_acknowledged_by IS NULL OR NULLIF(btrim(COALESCE(v_offer.payment_obligation_terms_version,'')),'') IS NULL THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','PAYMENT_OBLIGATION_ACK_REQUIRED','error_message','Carrier acceptance is blocked because the buyer payment obligation acknowledgement is missing.');
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id=v_offer.job_id FOR UPDATE;
  SELECT * INTO v_bid FROM public.job_bids WHERE id=v_offer.bid_id FOR UPDATE;
  IF COALESCE(v_job.status,'') NOT IN ('posted','quoted') OR COALESCE(v_bid.status,'')<>'submitted' THEN
    RETURN jsonb_build_object('success',false,'http_status',409,'error_code','OFFER_STALE','error_message','The underlying job or quote is no longer available for acceptance.');
  END IF;
  IF NOT (v_bid.bidder_user_id=v_actor OR EXISTS(SELECT 1 FROM public.company_memberships cm JOIN public.companies c ON c.id=cm.company_id WHERE cm.company_id=v_offer.carrier_company_id AND cm.user_id=v_actor AND cm.status::text='active' AND cm.role_in_company::text IN ('owner','admin','dispatcher') AND c.status::text='active')) THEN
    RETURN jsonb_build_object('success',false,'http_status',403,'error_code','FORBIDDEN','error_message','Only the awarded carrier may accept this booking offer.');
  END IF;
  v_issues:=public.company_compliance_issues(v_offer.carrier_company_id,'award');
  IF COALESCE(array_length(v_issues,1),0)>0 THEN RETURN jsonb_build_object('success',false,'http_status',409,'error_code','COMPLIANCE_BLOCKED','error_message',format('Compliance blocked carrier acceptance: %s',array_to_string(v_issues,' '))); END IF;

  v_vehicle_id:=NULL;
  IF v_offer.bidder_driver_id IS NOT NULL THEN
    SELECT d.* INTO v_driver FROM public.drivers d WHERE d.id=v_offer.bidder_driver_id;
    IF NOT FOUND OR v_driver.user_id IS DISTINCT FROM v_bid.bidder_user_id OR v_driver.company_id IS DISTINCT FROM v_offer.carrier_company_id THEN
      RETURN jsonb_build_object('success',false,'http_status',409,'error_code','DRIVER_IDENTITY_MISMATCH','error_message','The awarded driver identity is no longer valid.');
    END IF;
    SELECT readiness.eligible,readiness.vehicle_id,readiness.blockers INTO v_driver_eligible,v_vehicle_id,v_blockers FROM public.driver_operational_eligibility(v_offer.bidder_driver_id) readiness;
    IF NOT COALESCE(v_driver_eligible,false) THEN RETURN jsonb_build_object('success',false,'http_status',409,'error_code','DRIVER_NOT_OPERATIONALLY_ELIGIBLE','error_message','The awarded driver is no longer operationally eligible.','blockers',to_jsonb(COALESCE(v_blockers,ARRAY[]::text[]))); END IF;
    IF v_offer.quoted_vehicle_id IS NOT NULL THEN v_vehicle_id:=v_offer.quoted_vehicle_id; END IF;
  END IF;

  UPDATE public.job_bids jb SET status=CASE WHEN jb.id=v_bid.id THEN 'accepted' ELSE 'rejected' END,updated_at=now() WHERE jb.job_id=v_job.id AND jb.status IN ('submitted','accepted');
  v_final_status:=CASE WHEN v_offer.bidder_driver_id IS NOT NULL THEN 'allocated' ELSE 'awarded' END;
  UPDATE public.jobs j SET accepted_bid_id=v_bid.id,awarded_carrier_company_id=v_offer.carrier_company_id,assigned_company_id=v_offer.carrier_company_id,
    assigned_driver_id=CASE WHEN v_offer.bidder_driver_id IS NOT NULL THEN v_offer.bidder_driver_id ELSE NULL END,
    vehicle_id=CASE WHEN v_offer.bidder_driver_id IS NOT NULL THEN v_vehicle_id ELSE NULL END,status=v_final_status,current_status=v_final_status,
    status_history=COALESCE(j.status_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('status','awarded','timestamp',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'bid_id',v_bid.id,'booking_offer_id',v_offer.id,'carrier_accepted_by',v_actor))
      ||CASE WHEN v_offer.bidder_driver_id IS NOT NULL THEN jsonb_build_array(jsonb_build_object('status','allocated','timestamp',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'auto_assigned_driver_id',v_offer.bidder_driver_id,'auto_assigned_vehicle_id',v_vehicle_id)) ELSE '[]'::jsonb END,
    updated_at=now() WHERE j.id=v_job.id;

  INSERT INTO public.job_commercial_agreements(job_id,bid_id,buyer_company_id,supplier_company_id,agreed_amount,currency,agreed_at,created_by)
  VALUES(v_job.id,v_bid.id,v_offer.buyer_company_id,v_offer.carrier_company_id,v_offer.quoted_amount,v_offer.currency,now(),v_actor)
  RETURNING id INTO v_agreement_id;
  UPDATE public.job_booking_offers SET status='accepted',responded_by=v_actor,responded_at=now(),commercial_agreement_id=v_agreement_id WHERE id=v_offer.id;
  INSERT INTO public.job_tracking_events(job_id,event_type,created_by,message,meta) VALUES(v_job.id,'awarded',v_actor,'Carrier accepted booking offer; transport agreement formed.',jsonb_build_object('booking_offer_id',v_offer.id,'bid_id',v_bid.id,'commercial_agreement_id',v_agreement_id,'carrier_company_id',v_offer.carrier_company_id));
  IF v_offer.bidder_driver_id IS NOT NULL THEN INSERT INTO public.job_tracking_events(job_id,event_type,created_by,message,meta) VALUES(v_job.id,'allocated',v_actor,'Named bidder driver allocated after carrier acceptance.',jsonb_build_object('assigned_driver_id',v_offer.bidder_driver_id,'vehicle_id',v_vehicle_id)); END IF;
  RETURN jsonb_build_object('ok',true,'success',true,'http_status',200,'booking_offer_id',v_offer.id,'job_id',v_job.id,'bid_id',v_bid.id,'commercial_agreement_id',v_agreement_id,'job_status',v_final_status);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_job_booking_offer_atomic(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_booking_offer_atomic(uuid,uuid) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
