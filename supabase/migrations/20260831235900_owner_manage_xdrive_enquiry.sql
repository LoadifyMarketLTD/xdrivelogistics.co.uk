BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Platform Owner governance for the XDrive public-enquiry commercial lifecycle.
-- Every mutation is serialized on the quote row, reasoned, audited, and executed
-- through a service-role-only SECURITY DEFINER RPC. Job conversion and enquiry
-- conversion are one transaction, eliminating split-brain enquiry/job state.

CREATE OR REPLACE FUNCTION public.owner_manage_xdrive_enquiry(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_enquiry_id uuid,
  p_action text,
  p_reason text,
  p_amount numeric DEFAULT NULL,
  p_execution_mode text DEFAULT NULL,
  p_vehicle_type text DEFAULT NULL,
  p_requested_vehicle_label text DEFAULT NULL,
  p_cargo_type text DEFAULT NULL,
  p_requested_cargo_label text DEFAULT NULL,
  p_weight_kg numeric DEFAULT NULL,
  p_pallets integer DEFAULT NULL,
  p_collection_tail_lift_required boolean DEFAULT false,
  p_pickup_datetime timestamptz DEFAULT NULL,
  p_pickup_time_slot text DEFAULT NULL,
  p_delivery_datetime timestamptz DEFAULT NULL,
  p_delivery_time_slot text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_now timestamptz := now();
  v_quote public.quotes%ROWTYPE;
  v_updated public.quotes%ROWTYPE;
  v_old_status text;
  v_job_id uuid;
  v_job_status text;
  v_job_current_status text;
  v_publish boolean;
  v_replayed boolean := false;
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  IF p_company_id IS NULL OR p_enquiry_id IS NULL THEN
    RAISE EXCEPTION 'Company and enquiry are required.' USING ERRCODE = '22023';
  END IF;

  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'A governance reason is required.' USING ERRCODE = '22023';
  END IF;

  IF v_action NOT IN ('set_price', 'quote_sent', 'accepted', 'convert_to_job') THEN
    RAISE EXCEPTION 'Unsupported XDrive enquiry action.' USING ERRCODE = '22023';
  END IF;

  SELECT q.*
  INTO v_quote
  FROM public.quotes q
  WHERE q.id = p_enquiry_id
    AND q.company_id = p_company_id
    AND coalesce(q.notes, '') ILIKE '%SOURCE: app.xdrivelogistics.co.uk%'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'XDrive enquiry not found.' USING ERRCODE = 'P0002';
  END IF;

  v_old_status := coalesce(v_quote.status, 'draft');

  IF v_action = 'set_price' THEN
    IF v_quote.converted_job_id IS NOT NULL OR lower(coalesce(v_quote.status, 'draft')) IN ('quote_sent', 'accepted', 'converted') THEN
      RAISE EXCEPTION 'Price cannot be changed after the quote has been sent.' USING ERRCODE = '23514';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
      RAISE EXCEPTION 'Customer price must be greater than zero.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.quotes
    SET amount = p_amount,
        currency = 'GBP',
        status = 'priced',
        updated_at = v_now
    WHERE id = v_quote.id
    RETURNING * INTO v_updated;

    INSERT INTO public.owner_audit_log (
      actor_user_id, target_company_id, target_type, target_id, target_name,
      action_type, old_status, new_status, reason, metadata
    ) VALUES (
      p_actor_user_id, v_quote.company_id, 'xdrive_enquiry', v_quote.id,
      coalesce(v_quote.customer_name, 'XDrive public enquiry'),
      'xdrive_enquiry_price_set', v_old_status, 'priced', v_reason,
      jsonb_build_object('old_amount', v_quote.amount, 'new_amount', p_amount, 'currency', 'GBP')
    );

    RETURN jsonb_build_object('enquiry', to_jsonb(v_updated), 'replayed', false);
  END IF;

  IF v_action = 'quote_sent' THEN
    IF v_quote.converted_job_id IS NOT NULL OR lower(coalesce(v_quote.status, 'draft')) IN ('accepted', 'converted') THEN
      RAISE EXCEPTION 'This enquiry is already beyond quote-sent state.' USING ERRCODE = '23514';
    END IF;
    IF v_quote.amount IS NULL OR v_quote.amount <= 0 THEN
      RAISE EXCEPTION 'Set the customer price before marking the quote as sent.' USING ERRCODE = '23514';
    END IF;
    IF lower(coalesce(v_quote.status, '')) = 'quote_sent' THEN
      RETURN jsonb_build_object('enquiry', to_jsonb(v_quote), 'replayed', true);
    END IF;

    UPDATE public.quotes
    SET status = 'quote_sent',
        quote_sent_at = v_now,
        updated_at = v_now
    WHERE id = v_quote.id
    RETURNING * INTO v_updated;

    INSERT INTO public.owner_audit_log (
      actor_user_id, target_company_id, target_type, target_id, target_name,
      action_type, old_status, new_status, reason, metadata
    ) VALUES (
      p_actor_user_id, v_quote.company_id, 'xdrive_enquiry', v_quote.id,
      coalesce(v_quote.customer_name, 'XDrive public enquiry'),
      'xdrive_enquiry_quote_sent', v_old_status, 'quote_sent', v_reason,
      jsonb_build_object('amount', v_quote.amount, 'currency', coalesce(v_quote.currency, 'GBP'))
    );

    RETURN jsonb_build_object('enquiry', to_jsonb(v_updated), 'replayed', false);
  END IF;

  IF v_action = 'accepted' THEN
    IF v_quote.converted_job_id IS NOT NULL OR lower(coalesce(v_quote.status, '')) = 'converted' THEN
      RAISE EXCEPTION 'This enquiry has already been converted to a job.' USING ERRCODE = '23514';
    END IF;
    IF lower(coalesce(v_quote.status, '')) = 'accepted' THEN
      RETURN jsonb_build_object('enquiry', to_jsonb(v_quote), 'replayed', true);
    END IF;
    IF lower(coalesce(v_quote.status, '')) <> 'quote_sent' THEN
      RAISE EXCEPTION 'The quote must be marked as sent before it can be accepted.' USING ERRCODE = '23514';
    END IF;

    UPDATE public.quotes
    SET status = 'accepted',
        accepted_at = v_now,
        updated_at = v_now
    WHERE id = v_quote.id
    RETURNING * INTO v_updated;

    INSERT INTO public.owner_audit_log (
      actor_user_id, target_company_id, target_type, target_id, target_name,
      action_type, old_status, new_status, reason, metadata
    ) VALUES (
      p_actor_user_id, v_quote.company_id, 'xdrive_enquiry', v_quote.id,
      coalesce(v_quote.customer_name, 'XDrive public enquiry'),
      'xdrive_enquiry_accepted', v_old_status, 'accepted', v_reason,
      jsonb_build_object('amount', v_quote.amount, 'currency', coalesce(v_quote.currency, 'GBP'))
    );

    RETURN jsonb_build_object('enquiry', to_jsonb(v_updated), 'replayed', false);
  END IF;

  -- convert_to_job
  IF v_quote.converted_job_id IS NOT NULL THEN
    SELECT j.id, j.status, j.current_status
    INTO v_job_id, v_job_status, v_job_current_status
    FROM public.jobs j
    WHERE j.id = v_quote.converted_job_id;

    RETURN jsonb_build_object(
      'job', jsonb_build_object('id', v_quote.converted_job_id, 'status', v_job_status, 'current_status', v_job_current_status),
      'replayed', true,
      'executionMode', v_quote.execution_mode
    );
  END IF;

  IF lower(coalesce(v_quote.status, '')) <> 'accepted' THEN
    RAISE EXCEPTION 'The customer quote must be accepted before conversion to a job.' USING ERRCODE = '23514';
  END IF;

  IF v_quote.amount IS NULL OR v_quote.amount <= 0 THEN
    RAISE EXCEPTION 'An accepted enquiry must have a positive customer price before conversion.' USING ERRCODE = '23514';
  END IF;

  IF p_execution_mode IS NULL OR p_execution_mode NOT IN ('own_fleet', 'direct_carrier', 'marketplace') THEN
    RAISE EXCEPTION 'A valid execution mode is required.' USING ERRCODE = '22023';
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_quote.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The enquiry changed while conversion was being prepared. Reload and retry.' USING ERRCODE = '40001';
  END IF;

  IF btrim(coalesce(v_quote.pickup_location, '')) = '' OR btrim(coalesce(v_quote.delivery_location, '')) = '' THEN
    RAISE EXCEPTION 'Collection and delivery locations are required before conversion.' USING ERRCODE = '23514';
  END IF;

  IF p_pickup_datetime IS NULL THEN
    RAISE EXCEPTION 'Collection date/time is required before conversion.' USING ERRCODE = '23514';
  END IF;

  v_publish := p_execution_mode = 'marketplace';

  -- Reconcile a legacy partial conversion safely if an idempotent job already exists.
  SELECT j.id, j.status, j.current_status
  INTO v_job_id, v_job_status, v_job_current_status
  FROM public.jobs j
  WHERE j.company_id = v_quote.company_id
    AND j.creation_idempotency_key = v_quote.id::text
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    v_replayed := true;
  ELSE
    INSERT INTO public.jobs (
      company_id, created_by, creation_idempotency_key,
      status, current_status,
      pickup_location, pickup_postcode, pickup_datetime, pickup_time_slot,
      delivery_location, delivery_postcode, delivery_datetime, delivery_time_slot,
      client_name, client_email, client_phone,
      vehicle_type, requested_vehicle_label,
      cargo_type, requested_cargo_label,
      weight_kg, pallets, budget_amount,
      collection_tail_lift_required, load_details,
      exchange_visibility, exchange_posted_at, exchange_expires_at, updated_at
    ) VALUES (
      v_quote.company_id, p_actor_user_id, v_quote.id::text,
      CASE WHEN v_publish THEN 'posted' ELSE 'draft' END,
      CASE WHEN v_publish THEN 'posted' ELSE 'draft' END,
      upper(btrim(v_quote.pickup_location)), upper(btrim(v_quote.pickup_location)), p_pickup_datetime, p_pickup_time_slot,
      upper(btrim(v_quote.delivery_location)), upper(btrim(v_quote.delivery_location)), p_delivery_datetime, p_delivery_time_slot,
      v_quote.customer_name, v_quote.customer_email, v_quote.customer_phone,
      p_vehicle_type, p_requested_vehicle_label,
      p_cargo_type, p_requested_cargo_label,
      p_weight_kg, p_pallets, v_quote.amount,
      coalesce(p_collection_tail_lift_required, false),
      jsonb_build_object(
        'source', 'xdrive_public_enquiry',
        'enquiryId', v_quote.id,
        'executionMode', p_execution_mode,
        'sourceNotes', v_quote.notes
      ),
      CASE WHEN v_publish THEN 'exchange' ELSE 'private' END,
      CASE WHEN v_publish THEN v_now ELSE NULL END,
      CASE WHEN v_publish THEN v_now + interval '72 hours' ELSE NULL END,
      v_now
    )
    RETURNING id, status, current_status
    INTO v_job_id, v_job_status, v_job_current_status;
  END IF;

  UPDATE public.quotes
  SET status = 'converted',
      converted_at = v_now,
      converted_job_id = v_job_id,
      execution_mode = p_execution_mode,
      updated_at = v_now
  WHERE id = v_quote.id
  RETURNING * INTO v_updated;

  INSERT INTO public.owner_audit_log (
    actor_user_id, target_company_id, target_type, target_id, target_name,
    action_type, old_status, new_status, reason, metadata
  ) VALUES (
    p_actor_user_id, v_quote.company_id, 'xdrive_enquiry', v_quote.id,
    coalesce(v_quote.customer_name, 'XDrive public enquiry'),
    'xdrive_enquiry_converted', v_old_status, 'converted', v_reason,
    jsonb_build_object(
      'job_id', v_job_id,
      'execution_mode', p_execution_mode,
      'reconciled_existing_job', v_replayed
    )
  );

  RETURN jsonb_build_object(
    'job', jsonb_build_object('id', v_job_id, 'status', v_job_status, 'current_status', v_job_current_status),
    'enquiry', to_jsonb(v_updated),
    'replayed', v_replayed,
    'executionMode', p_execution_mode
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_manage_xdrive_enquiry(
  uuid, uuid, uuid, text, text, numeric, text, text, text, text, text,
  numeric, integer, boolean, timestamptz, text, timestamptz, text, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.owner_manage_xdrive_enquiry(
  uuid, uuid, uuid, text, text, numeric, text, text, text, text, text,
  numeric, integer, boolean, timestamptz, text, timestamptz, text, timestamptz
) TO service_role;

COMMIT;
