BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.job_commercial_agreements
  ADD COLUMN IF NOT EXISTS snapshot_schema_version text,
  ADD COLUMN IF NOT EXISTS buyer_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS supplier_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS job_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS contract_snapshot_hash text;

COMMENT ON COLUMN public.job_commercial_agreements.snapshot_schema_version IS
  'Version of the immutable contractual snapshot captured at agreement creation. Historical rows created before this feature may be null.';
COMMENT ON COLUMN public.job_commercial_agreements.buyer_snapshot IS
  'Immutable buyer/ordering-party identity captured when the commercial agreement is created.';
COMMENT ON COLUMN public.job_commercial_agreements.supplier_snapshot IS
  'Immutable performing-carrier identity captured when the commercial agreement is created.';
COMMENT ON COLUMN public.job_commercial_agreements.job_snapshot IS
  'Immutable transport requirement snapshot captured when the commercial agreement is created.';
COMMENT ON COLUMN public.job_commercial_agreements.contract_snapshot_hash IS
  'SHA-256 of the canonical contractual snapshot payload captured on insert.';

ALTER TABLE public.job_commercial_agreements
  DROP CONSTRAINT IF EXISTS job_commercial_agreements_contract_snapshot_complete;
ALTER TABLE public.job_commercial_agreements
  ADD CONSTRAINT job_commercial_agreements_contract_snapshot_complete CHECK (
    (snapshot_schema_version IS NULL AND buyer_snapshot IS NULL AND supplier_snapshot IS NULL AND job_snapshot IS NULL AND contract_snapshot_hash IS NULL)
    OR
    (snapshot_schema_version IS NOT NULL AND buyer_snapshot IS NOT NULL AND supplier_snapshot IS NOT NULL AND job_snapshot IS NOT NULL AND contract_snapshot_hash ~ '^[0-9a-f]{64}$')
  );

CREATE OR REPLACE FUNCTION public.fn_complete_commercial_agreement_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_payment_terms text;
  v_job_pod_required boolean;
  v_supplier_default_vat_rate integer;
  v_supplier_default_payment_terms text;
  v_resolved_payment_terms text;
  v_resolved_vat_rate smallint;
  v_expected_vat numeric(12,2);
  v_expected_gross numeric(12,2);
  v_buyer public.companies%ROWTYPE;
  v_supplier public.companies%ROWTYPE;
  v_buyer_legal_name text;
  v_supplier_legal_name text;
  v_job_json jsonb;
  v_hash_payload jsonb;
BEGIN
  IF NEW.agreed_amount IS NULL OR NEW.agreed_amount <= 0 THEN
    RAISE EXCEPTION 'Commercial agreement amount must be positive.' USING ERRCODE = '23514';
  END IF;

  SELECT j.payment_terms, j.pod_required, cs.default_vat_rate, cs.default_payment_terms, to_jsonb(j)
    INTO v_job_payment_terms, v_job_pod_required, v_supplier_default_vat_rate,
         v_supplier_default_payment_terms, v_job_json
  FROM public.jobs j
  LEFT JOIN public.company_settings cs ON cs.company_id = NEW.supplier_company_id
  WHERE j.id = NEW.job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial agreement job was not found.' USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_buyer FROM public.companies WHERE id = NEW.buyer_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial agreement buyer company was not found.' USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_supplier FROM public.companies WHERE id = NEW.supplier_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial agreement supplier company was not found.' USING ERRCODE = '23503';
  END IF;

  SELECT legal_name INTO v_buyer_legal_name FROM public.company_settings WHERE company_id = NEW.buyer_company_id;
  SELECT legal_name INTO v_supplier_legal_name FROM public.company_settings WHERE company_id = NEW.supplier_company_id;

  v_resolved_payment_terms := COALESCE(
    NULLIF(btrim(NEW.payment_terms), ''), NULLIF(btrim(v_job_payment_terms), ''),
    NULLIF(btrim(v_supplier_default_payment_terms), ''), '14 days'
  );

  v_resolved_vat_rate := CASE
    WHEN NEW.vat_rate IN (0, 5, 20) THEN NEW.vat_rate
    WHEN v_supplier_default_vat_rate IN (0, 5, 20) THEN v_supplier_default_vat_rate::smallint
    ELSE 0
  END;

  v_expected_vat := round((NEW.agreed_amount * v_resolved_vat_rate) / 100.0, 2);
  NEW.accepted_at := COALESCE(NEW.accepted_at, NEW.agreed_at, NEW.created_at, now());
  NEW.agreement_status := COALESCE(NULLIF(btrim(NEW.agreement_status), ''), 'accepted');
  NEW.payment_terms := v_resolved_payment_terms;
  NEW.payment_due_days := COALESCE(NEW.payment_due_days, public.fn_parse_payment_due_days(v_resolved_payment_terms));
  NEW.pod_required := COALESCE(NEW.pod_required, v_job_pod_required, true);
  NEW.vat_rate := v_resolved_vat_rate;
  NEW.vat_amount := CASE WHEN NEW.vat_amount IS NULL OR (v_resolved_vat_rate > 0 AND NEW.vat_amount = 0)
    THEN v_expected_vat ELSE round(NEW.vat_amount, 2) END;
  v_expected_gross := round(NEW.agreed_amount + NEW.vat_amount, 2);
  NEW.agreed_gross_amount := CASE WHEN NEW.agreed_gross_amount IS NULL OR NEW.agreed_gross_amount <= 0
    THEN v_expected_gross ELSE round(NEW.agreed_gross_amount, 2) END;

  IF NEW.payment_due_days < 0 THEN
    RAISE EXCEPTION 'Commercial agreement payment due days cannot be negative.' USING ERRCODE = '23514';
  END IF;
  IF NEW.vat_amount < 0 OR abs(NEW.vat_amount - v_expected_vat) > 0.01 THEN
    RAISE EXCEPTION 'Commercial agreement VAT does not match its net amount and VAT rate.' USING ERRCODE = '23514';
  END IF;
  IF abs(NEW.agreed_gross_amount - v_expected_gross) > 0.01 THEN
    RAISE EXCEPTION 'Commercial agreement gross amount must equal net amount plus VAT.' USING ERRCODE = '23514';
  END IF;

  NEW.snapshot_schema_version := '1';
  NEW.buyer_snapshot := jsonb_build_object(
    'company_id', v_buyer.id, 'legal_name', COALESCE(NULLIF(btrim(v_buyer_legal_name), ''), v_buyer.name),
    'trading_name', v_buyer.name, 'company_number', v_buyer.company_number, 'vat_number', v_buyer.vat_number,
    'email', v_buyer.email, 'phone', v_buyer.phone,
    'address', jsonb_build_object('line1', v_buyer.address_line1, 'line2', v_buyer.address_line2,
      'city', v_buyer.city, 'postcode', v_buyer.postcode, 'country', v_buyer.country),
    'company_type', v_buyer.company_type
  );
  NEW.supplier_snapshot := jsonb_build_object(
    'company_id', v_supplier.id, 'legal_name', COALESCE(NULLIF(btrim(v_supplier_legal_name), ''), v_supplier.name),
    'trading_name', v_supplier.name, 'company_number', v_supplier.company_number, 'vat_number', v_supplier.vat_number,
    'email', v_supplier.email, 'phone', v_supplier.phone,
    'address', jsonb_build_object('line1', v_supplier.address_line1, 'line2', v_supplier.address_line2,
      'city', v_supplier.city, 'postcode', v_supplier.postcode, 'country', v_supplier.country),
    'company_type', v_supplier.company_type
  );
  NEW.job_snapshot := jsonb_build_object(
    'job_id', NEW.job_id,
    'pickup', jsonb_build_object('location', v_job_json->'pickup_location', 'postcode', v_job_json->'pickup_postcode',
      'datetime', v_job_json->'pickup_datetime', 'time_slot', v_job_json->'pickup_time_slot',
      'contact_name', v_job_json->'collection_contact_name', 'contact_phone', v_job_json->'collection_contact_phone'),
    'delivery', jsonb_build_object('location', v_job_json->'delivery_location', 'postcode', v_job_json->'delivery_postcode',
      'datetime', v_job_json->'delivery_datetime', 'time_slot', v_job_json->'delivery_time_slot',
      'contact_name', v_job_json->'delivery_contact_name', 'contact_phone', v_job_json->'delivery_contact_phone'),
    'cargo', jsonb_build_object('cargo_type', v_job_json->'cargo_type', 'pallets', v_job_json->'pallets',
      'boxes', v_job_json->'boxes', 'bags', v_job_json->'bags', 'items', v_job_json->'items',
      'weight_kg', v_job_json->'weight_kg', 'length_cm', v_job_json->'length_cm',
      'width_cm', v_job_json->'width_cm', 'height_cm', v_job_json->'height_cm'),
    'requirements', jsonb_build_object('vehicle_type', v_job_json->'vehicle_type',
      'special_requirements', v_job_json->'special_requirements', 'access_restrictions', v_job_json->'access_restrictions',
      'tail_lift_required', v_job_json->'tail_lift_required', 'handball_required', v_job_json->'handball_required',
      'forklift_required', v_job_json->'forklift_required'),
    'references', jsonb_build_object('customer_reference', v_job_json->'customer_reference',
      'purchase_order_number', v_job_json->'purchase_order_number', 'booking_reference', v_job_json->'booking_reference')
  );

  v_hash_payload := jsonb_build_object(
    'schema_version', NEW.snapshot_schema_version, 'buyer', NEW.buyer_snapshot, 'supplier', NEW.supplier_snapshot,
    'job', NEW.job_snapshot, 'commercial', jsonb_build_object('net_amount', NEW.agreed_amount,
      'vat_rate', NEW.vat_rate, 'vat_amount', NEW.vat_amount, 'gross_amount', NEW.agreed_gross_amount,
      'currency', NEW.currency, 'payment_terms', NEW.payment_terms, 'payment_due_days', NEW.payment_due_days,
      'pod_required', NEW.pod_required, 'accepted_at', NEW.accepted_at)
  );
  NEW.contract_snapshot_hash := encode(digest(convert_to(v_hash_payload::text, 'UTF8'), 'sha256'), 'hex');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_commercial_agreement_snapshot ON public.job_commercial_agreements;
CREATE TRIGGER trg_complete_commercial_agreement_snapshot
BEFORE INSERT ON public.job_commercial_agreements
FOR EACH ROW EXECUTE FUNCTION public.fn_complete_commercial_agreement_snapshot();

COMMIT;
NOTIFY pgrst, 'reload schema';

