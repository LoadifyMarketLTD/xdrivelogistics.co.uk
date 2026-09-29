-- XDrive Contract Protection E2E DB smoke
-- Runs against the real XDrive schema only after the pending contract-protection
-- migrations are loaded. All synthetic data is enclosed in this transaction and
-- is removed by ROLLBACK at the end.
BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);

DO $$
DECLARE
  v_owner_driver_user constant uuid := '831b8754-9fed-4001-918b-f0132fd21acf';
  v_owner_driver_company constant uuid := '3754b8fd-2ee1-42cf-a172-309058c5dc04';
  v_owner_driver_driver constant uuid := '9fe67b29-0c3f-459e-b968-eef703b00748';
  v_owner_driver_vehicle constant uuid := '95c40413-ac39-40b9-9925-c9de4039e129';
  v_payment_terms_version constant text := 'xdrive-booking-payment-obligation-v1-2026-09-26';
  v_scenario record;
  v_requested_scenario text := current_setting('xdrive.e2e.scenario', true);
  v_scenario_count integer := 0;
  v_job_id uuid;
  v_bid_id uuid;
  v_offer public.job_booking_offers%ROWTYPE;
  v_offer_result jsonb;
  v_accept_result jsonb;
  v_agreement public.job_commercial_agreements%ROWTYPE;
  v_amendment public.job_commercial_agreement_amendments%ROWTYPE;
  v_dispute_id uuid;
  v_amount numeric(12,2);
BEGIN
  IF v_requested_scenario IS NULL OR v_requested_scenario NOT IN ('customer_to_carrier','broker_to_carrier','carrier_to_subcontractor') THEN
    RAISE EXCEPTION 'Set xdrive.e2e.scenario to one approved contract flow before running this smoke.';
  END IF;

  FOR v_scenario IN
    SELECT * FROM (VALUES
      ('customer_to_carrier'::text, 'd00bc676-0cf4-41b7-9346-a1348fdb4c7a'::uuid, 'b83d46fa-4ce2-4b8d-a901-90b1c494a0c2'::uuid, 410.00::numeric),
      ('broker_to_carrier', '5587a84f-de1f-4e35-9991-3a6857de477d'::uuid, '0c6eb770-4050-4a3e-89d6-6961933ba336'::uuid, 420.00::numeric),
      ('carrier_to_subcontractor', '1e7fbbb9-15f9-408d-88c8-84ab34959a61'::uuid, '3e8e8dcb-b62e-4f9f-aa22-bd85901b99b1'::uuid, 430.00::numeric)
    ) AS scenarios(name,buyer_company_id,buyer_user_id,quote_amount)
    WHERE name = v_requested_scenario
  LOOP
    v_scenario_count := v_scenario_count + 1;
    v_job_id := gen_random_uuid();
    v_bid_id := gen_random_uuid();
    v_amount := v_scenario.quote_amount;

    INSERT INTO public.jobs(
      id, company_id, posted_by_company_id, created_by,
      pickup_location, delivery_location, pickup_datetime, delivery_datetime,
      pickup_postcode, delivery_postcode, status, current_status,
      vehicle_type, weight_kg, payment_terms,
      pod_required, customer_reference, currency
    ) VALUES (
      v_job_id, v_scenario.buyer_company_id, v_scenario.buyer_company_id, v_scenario.buyer_user_id,
      'E2E TEST PICKUP', 'E2E TEST DELIVERY', now() + interval '7 days', now() + interval '7 days 4 hours',
      'GU1 1AA', 'BB1 1AA', 'posted', 'posted',
      'luton', 500, '14 days',
      true, 'E2E-' || upper(substr(v_scenario.name,1,8)), 'GBP'
    );

    INSERT INTO public.job_bids(
      id, job_id, bidder_company_id, bidder_user_id, bidder_id, bidder_driver_id,
      company_id, amount, bid_price_gbp, currency, status,
      quote_vehicle_id, quote_vehicle_type, message
    ) VALUES (
      v_bid_id, v_job_id, v_owner_driver_company, v_owner_driver_user, v_owner_driver_driver, v_owner_driver_driver,
      v_owner_driver_company, v_amount, v_amount, 'GBP', 'submitted',
      v_owner_driver_vehicle, 'luton', 'E2E contract-protection quote'
    );

    SELECT public.award_job_bid_pending_atomic(
      v_bid_id,
      v_scenario.buyer_user_id,
      true,
      v_payment_terms_version
    ) INTO v_offer_result;

    IF COALESCE((v_offer_result->>'success')::boolean,false) IS NOT TRUE THEN
      RAISE EXCEPTION '%: award RPC failed: %', v_scenario.name, v_offer_result::text;
    END IF;

    SELECT * INTO STRICT v_offer
    FROM public.job_booking_offers
    WHERE id=(v_offer_result->>'booking_offer_id')::uuid;

    IF v_offer.status <> 'pending' THEN
      RAISE EXCEPTION '%: award did not create a pending booking offer', v_scenario.name;
    END IF;
    IF v_offer.buyer_company_id <> v_scenario.buyer_company_id OR v_offer.carrier_company_id <> v_owner_driver_company THEN
      RAISE EXCEPTION '%: booking offer parties do not match expected buyer/carrier', v_scenario.name;
    END IF;
    IF v_offer.payment_obligation_acknowledged_at IS NULL OR v_offer.payment_obligation_terms_version <> v_payment_terms_version THEN
      RAISE EXCEPTION '%: payment obligation acknowledgement was not persisted', v_scenario.name;
    END IF;
    IF EXISTS (SELECT 1 FROM public.job_commercial_agreements a WHERE a.job_id=v_job_id) THEN
      RAISE EXCEPTION '%: commercial agreement existed before carrier acceptance', v_scenario.name;
    END IF;

    SELECT public.accept_job_booking_offer_atomic(v_offer.id, v_owner_driver_user)
    INTO v_accept_result;

    IF COALESCE((v_accept_result->>'success')::boolean,false) IS NOT TRUE THEN
      RAISE EXCEPTION '%: carrier acceptance RPC failed: %', v_scenario.name, v_accept_result::text;
    END IF;

    SELECT * INTO STRICT v_offer
    FROM public.job_booking_offers
    WHERE id=v_offer.id;

    IF v_offer.status <> 'accepted' OR v_offer.responded_at IS NULL THEN
      RAISE EXCEPTION '%: carrier acceptance did not finalize booking offer', v_scenario.name;
    END IF;
    SELECT * INTO STRICT v_agreement
    FROM public.job_commercial_agreements
    WHERE job_id=v_job_id;

    IF v_agreement.agreement_status <> 'accepted' OR v_agreement.buyer_company_id <> v_scenario.buyer_company_id OR v_agreement.supplier_company_id <> v_owner_driver_company THEN
      RAISE EXCEPTION '%: accepted commercial agreement parties/status invalid', v_scenario.name;
    END IF;
    IF v_agreement.contract_snapshot_hash IS NULL OR v_agreement.contract_snapshot_hash !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION '%: immutable contract snapshot hash missing', v_scenario.name;
    END IF;
    IF v_agreement.snapshot_schema_version IS NULL OR v_agreement.buyer_snapshot IS NULL OR v_agreement.supplier_snapshot IS NULL OR v_agreement.job_snapshot IS NULL THEN
      RAISE EXCEPTION '%: full commercial identity snapshot incomplete', v_scenario.name;
    END IF;

    INSERT INTO public.job_commercial_agreement_amendments(
      agreement_id, proposed_by_user_id, proposed_by_company_id,
      reason, change_summary, effective_agreed_amount,
      currency, vat_treatment, vat_rate, vat_amount, effective_gross_amount,
      payment_terms, payment_due_days, pod_required, effective_job_snapshot
    ) VALUES (
      v_agreement.id, v_scenario.buyer_user_id, v_scenario.buyer_company_id,
      'E2E verified price amendment', jsonb_build_object('scenario',v_scenario.name), v_amount + 25,
      v_agreement.currency, v_agreement.vat_treatment, v_agreement.vat_rate, 0, v_amount + 25,
      v_agreement.payment_terms, v_agreement.payment_due_days, v_agreement.pod_required, v_agreement.job_snapshot
    ) RETURNING * INTO v_amendment;

    UPDATE public.job_commercial_agreement_amendments
    SET status='accepted', decided_by_user_id=v_owner_driver_user,
        decided_by_company_id=v_owner_driver_company, decision_note='E2E accepted amendment', decided_at=now()
    WHERE id=v_amendment.id
    RETURNING * INTO v_amendment;

    IF v_amendment.status <> 'accepted' OR v_amendment.version_number <> 2 OR v_amendment.effective_snapshot_hash !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION '%: accepted amendment/version/hash invalid', v_scenario.name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.job_commercial_agreements_effective e
      WHERE e.id=v_agreement.id AND e.contract_version=2 AND e.active_amendment_id=v_amendment.id
        AND e.agreed_amount=v_amount+25
    ) THEN
      RAISE EXCEPTION '%: effective agreement did not project accepted amendment', v_scenario.name;
    END IF;

    INSERT INTO public.job_disputes(job_id,raised_by_company_id,status,description)
    VALUES(v_job_id,v_scenario.buyer_company_id,'open','E2E dispute evidence for '||v_scenario.name)
    RETURNING id INTO v_dispute_id;

    IF NOT EXISTS (SELECT 1 FROM public.job_disputes d WHERE d.id=v_dispute_id AND d.status='open') THEN
      RAISE EXCEPTION '%: dispute record was not persisted', v_scenario.name;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.job_tracking_events e
      WHERE e.job_id=v_job_id AND e.event_type IN ('booking_offer_created','awarded')
    ) THEN
      RAISE EXCEPTION '%: booking lifecycle audit events missing', v_scenario.name;
    END IF;
  END LOOP;

  IF v_scenario_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one E2E scenario, ran %', v_scenario_count;
  END IF;
END;
$$;

ROLLBACK;
