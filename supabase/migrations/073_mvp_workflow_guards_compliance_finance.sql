-- Migration 073: MVP workflow guards, compliance gating, and finance tracking ledger

BEGIN;

-- ── Compliance helpers ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.normalize_doc_type(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(coalesce(trim(p_value), '')), '[^a-z0-9]+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.company_compliance_issues(
  p_company_id uuid,
  p_context text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues text[] := ARRAY[]::text[];
  v_missing_driver_docs text[] := ARRAY[]::text[];
  v_missing_vehicle_docs text[] := ARRAY[]::text[];
BEGIN
  IF p_company_id IS NULL THEN
    RETURN ARRAY['No company context available for compliance validation.'];
  END IF;

  WITH required_docs AS (
    SELECT unnest(ARRAY['drivinglicence', 'cpccard', 'insurance']) AS normalized_doc
  ),
  present_docs AS (
    SELECT DISTINCT public.normalize_doc_type(dd.doc_type) AS normalized_doc
    FROM public.driver_documents dd
    JOIN public.drivers d ON d.id = dd.driver_id
    WHERE d.company_id = p_company_id
      AND coalesce(d.status, 'active') = 'active'
      AND dd.status = 'approved'
      AND (dd.expiry_date IS NULL OR dd.expiry_date >= CURRENT_DATE)
  )
  SELECT coalesce(array_agg(rd.normalized_doc), ARRAY[]::text[])
  INTO v_missing_driver_docs
  FROM required_docs rd
  LEFT JOIN present_docs pd ON pd.normalized_doc = rd.normalized_doc
  WHERE pd.normalized_doc IS NULL;

  WITH required_docs AS (
    SELECT unnest(ARRAY['mot', 'insurance']) AS normalized_doc
  ),
  present_docs AS (
    SELECT DISTINCT public.normalize_doc_type(vd.doc_type) AS normalized_doc
    FROM public.vehicle_documents vd
    JOIN public.vehicles v ON v.id = vd.vehicle_id
    WHERE v.company_id = p_company_id
      AND vd.status = 'approved'
      AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
  )
  SELECT coalesce(array_agg(rd.normalized_doc), ARRAY[]::text[])
  INTO v_missing_vehicle_docs
  FROM required_docs rd
  LEFT JOIN present_docs pd ON pd.normalized_doc = rd.normalized_doc
  WHERE pd.normalized_doc IS NULL;

  IF coalesce(array_length(v_missing_driver_docs, 1), 0) > 0 THEN
    v_issues := array_append(
      v_issues,
      format('Missing approved driver compliance documents: %s.', array_to_string(v_missing_driver_docs, ', '))
    );
  END IF;

  IF coalesce(array_length(v_missing_vehicle_docs, 1), 0) > 0 THEN
    v_issues := array_append(
      v_issues,
      format('Missing approved vehicle compliance documents: %s.', array_to_string(v_missing_vehicle_docs, ', '))
    );
  END IF;

  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.company_compliance_issues(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_compliance_issues(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_compliance_issues(uuid, text) TO service_role;

-- ── Job lifecycle guard rails (status + POD + compliance) ─────────────────────

CREATE OR REPLACE FUNCTION public.fn_jobs_mvp_guardrails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_next text[];
  v_carrier_company_id uuid;
  v_issues text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_allowed_next := CASE OLD.status::text
        WHEN 'draft' THEN ARRAY['posted', 'cancelled', 'disputed']
        WHEN 'posted' THEN ARRAY['allocated', 'cancelled', 'disputed']
        WHEN 'allocated' THEN ARRAY['in_transit', 'cancelled', 'disputed']
        WHEN 'in_transit' THEN ARRAY['delivered', 'cancelled', 'disputed']
        WHEN 'delivered' THEN ARRAY[]::text[]
        WHEN 'cancelled' THEN ARRAY[]::text[]
        WHEN 'disputed' THEN ARRAY[]::text[]
        ELSE ARRAY[]::text[]
      END;

      IF NOT (NEW.status::text = ANY (v_allowed_next)) THEN
        RAISE EXCEPTION 'Invalid job status transition: % -> %', OLD.status, NEW.status;
      END IF;

      IF NEW.status::text = 'in_transit'
         AND (NEW.collection_photo_url IS NULL OR btrim(NEW.collection_photo_url) = '')
      THEN
        RAISE EXCEPTION 'POD incomplete: collection photo is required before moving to in_transit.';
      END IF;

      IF NEW.status::text = 'delivered' THEN
        IF NEW.delivery_photos IS NULL OR coalesce(array_length(NEW.delivery_photos, 1), 0) < 1 THEN
          RAISE EXCEPTION 'POD incomplete: at least one delivery photo is required before delivery completion.';
        END IF;
        IF NEW.delivery_signature_data IS NULL OR btrim(NEW.delivery_signature_data) = '' THEN
          RAISE EXCEPTION 'POD incomplete: recipient signature is required before delivery completion.';
        END IF;
        IF NEW.client_signature_name IS NULL OR btrim(NEW.client_signature_name) = '' THEN
          RAISE EXCEPTION 'POD incomplete: recipient name is required before delivery completion.';
        END IF;
      END IF;
    END IF;
  END IF;

  IF NEW.exchange_visibility = 'exchange'
     AND (TG_OP = 'INSERT' OR coalesce(OLD.exchange_visibility, '') <> 'exchange')
  THEN
    v_issues := public.company_compliance_issues(NEW.company_id, 'publish');
    IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Compliance blocked publish action: %', array_to_string(v_issues, ' ');
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)
  THEN
    IF NEW.status::text IN ('allocated', 'in_transit', 'delivered') THEN
      v_carrier_company_id := coalesce(NEW.awarded_carrier_company_id, NEW.company_id);
      v_issues := public.company_compliance_issues(v_carrier_company_id, 'execution');
      IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Compliance blocked execution action: %', array_to_string(v_issues, ' ');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_mvp_guardrails ON public.jobs;
CREATE TRIGGER trg_jobs_mvp_guardrails
BEFORE INSERT OR UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_jobs_mvp_guardrails();

-- ── Bid lifecycle compliance guard ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_job_bids_compliance_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues text[];
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'submitted' THEN
    v_issues := public.company_compliance_issues(NEW.company_id, 'bid');
    IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Compliance blocked bid action: %', array_to_string(v_issues, ' ');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_bids_compliance_guard ON public.job_bids;
CREATE TRIGGER trg_job_bids_compliance_guard
BEFORE INSERT OR UPDATE OF status ON public.job_bids
FOR EACH ROW
EXECUTE FUNCTION public.fn_job_bids_compliance_guard();

-- ── Atomic bid acceptance with compliance check ────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_job_bid_atomic(
  p_bid_id uuid,
  p_actor_user_id uuid
)
RETURNS TABLE (
  success boolean,
  http_status integer,
  error_code text,
  error_message text,
  bid_id uuid,
  job_id uuid,
  awarded_carrier_company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_job_company_id uuid;
  v_bid_company_id uuid;
  v_bid_status text;
  v_exchange_visibility text;
  v_awarded_carrier_company_id uuid;
  v_actor_role text;
  v_accepted_count integer;
  v_award_count integer;
  v_owner_driver_id uuid;
  v_bid_issues text[];
BEGIN
  SELECT
    jb.job_id,
    j.company_id,
    jb.company_id,
    jb.status,
    j.exchange_visibility,
    j.awarded_carrier_company_id
  INTO
    v_job_id,
    v_job_company_id,
    v_bid_company_id,
    v_bid_status,
    v_exchange_visibility,
    v_awarded_carrier_company_id
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id
  FOR UPDATE OF jb, j;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 404, 'NOT_FOUND', 'Bid not found.', NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT cm.role_in_company
  INTO v_actor_role
  FROM public.company_memberships cm
  WHERE cm.user_id = p_actor_user_id
    AND cm.company_id = v_job_company_id
    AND cm.status = 'active'
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN', 'Forbidden — you are not a member of the job-owning company.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_actor_role NOT IN ('owner', 'admin', 'dispatcher') THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN', 'Forbidden — insufficient role to accept bids.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_exchange_visibility NOT IN ('exchange', 'direct') THEN
    RETURN QUERY SELECT false, 400, 'BAD_REQUEST', 'Bad request — this job is not on the exchange.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_status <> 'submitted' THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — only submitted bids can be accepted.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_awarded_carrier_company_id IS NOT NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — this job has already been awarded to a carrier.', p_bid_id, v_job_id, v_awarded_carrier_company_id;
    RETURN;
  END IF;

  IF v_bid_company_id IS NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — bid company is missing.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_company_id = v_job_company_id THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN', 'Forbidden — cannot accept a bid placed by your own company.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  v_bid_issues := public.company_compliance_issues(v_bid_company_id, 'award');
  IF coalesce(array_length(v_bid_issues, 1), 0) > 0 THEN
    RETURN QUERY
      SELECT
        false,
        409,
        'COMPLIANCE_BLOCKED',
        format('Compliance blocked award action: %s', array_to_string(v_bid_issues, ' ')),
        p_bid_id,
        v_job_id,
        NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.job_bids
  SET status = 'accepted'
  WHERE id = p_bid_id
    AND status = 'submitted';
  GET DIAGNOSTICS v_accepted_count = ROW_COUNT;

  IF v_accepted_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — bid is no longer in submitted status.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.job_bids
  SET status = 'rejected'
  WHERE job_id = v_job_id
    AND id <> p_bid_id
    AND status = 'submitted';

  SELECT d.id
  INTO v_owner_driver_id
  FROM public.drivers d
  WHERE d.company_id = v_bid_company_id
    AND d.app_access = true
  ORDER BY d.created_at
  LIMIT 1;

  UPDATE public.jobs
  SET
    awarded_carrier_company_id = v_bid_company_id,
    status                     = 'allocated',
    assigned_driver_id         = COALESCE(v_owner_driver_id, assigned_driver_id),
    status_history             = COALESCE(status_history, '[]'::jsonb)
                                   || jsonb_build_object(
                                        'status',    'allocated',
                                        'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                                      )
  WHERE id = v_job_id
    AND awarded_carrier_company_id IS NULL;
  GET DIAGNOSTICS v_award_count = ROW_COUNT;

  IF v_award_count <> 1 THEN
    RAISE EXCEPTION 'Atomic award update failed for job %', v_job_id;
  END IF;

  RETURN QUERY SELECT true, 200, NULL::text, NULL::text, p_bid_id, v_job_id, v_bid_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

-- ── Finance tracking (recording only) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_status public.invoice_status,
  to_status public.invoice_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  note text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recorded_by uuid REFERENCES auth.users(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GBP',
  paid_at timestamptz NOT NULL DEFAULT now(),
  settlement_method text NOT NULL DEFAULT 'bank_transfer',
  external_reference text,
  note text,
  status_after public.invoice_status,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS invoice_status_history_invoice_id_idx
  ON public.invoice_status_history (invoice_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS invoice_payment_history_invoice_id_idx
  ON public.invoice_payment_history (invoice_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS invoice_disputes_invoice_id_idx
  ON public.invoice_disputes (invoice_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_log_invoice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_status_history (invoice_id, company_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NEW.company_id, NULL, NEW.status, NEW.created_by, 'Invoice created');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.invoice_status_history (invoice_id, company_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NEW.company_id, OLD.status, NEW.status, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_status_history_insert ON public.invoices;
CREATE TRIGGER trg_invoice_status_history_insert
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_invoice_status_change();

DROP TRIGGER IF EXISTS trg_invoice_status_history_update ON public.invoices;
CREATE TRIGGER trg_invoice_status_history_update
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_invoice_status_change();

CREATE OR REPLACE FUNCTION public.fn_apply_invoice_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_amount numeric(12,2);
  v_total_paid numeric(12,2);
  v_next_status public.invoice_status;
BEGIN
  SELECT amount
  INTO v_invoice_amount
  FROM public.invoices
  WHERE id = NEW.invoice_id
    AND company_id = NEW.company_id;

  IF v_invoice_amount IS NULL THEN
    RAISE EXCEPTION 'Invoice % not found for company %', NEW.invoice_id, NEW.company_id;
  END IF;

  SELECT coalesce(sum(amount), 0)
  INTO v_total_paid
  FROM public.invoice_payment_history
  WHERE invoice_id = NEW.invoice_id
    AND company_id = NEW.company_id;

  v_next_status := coalesce(
    NEW.status_after,
    CASE WHEN v_total_paid >= v_invoice_amount THEN 'Paid'::public.invoice_status ELSE NULL END
  );

  IF v_next_status IS NOT NULL THEN
    UPDATE public.invoices
    SET status = v_next_status
    WHERE id = NEW.invoice_id
      AND company_id = NEW.company_id
      AND status IS DISTINCT FROM v_next_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_invoice_payment ON public.invoice_payment_history;
CREATE TRIGGER trg_apply_invoice_payment
AFTER INSERT ON public.invoice_payment_history
FOR EACH ROW
EXECUTE FUNCTION public.fn_apply_invoice_payment();

ALTER TABLE public.invoice_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_status_history_member_access ON public.invoice_status_history;
CREATE POLICY invoice_status_history_member_access ON public.invoice_status_history
  FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS invoice_payment_history_member_access ON public.invoice_payment_history;
CREATE POLICY invoice_payment_history_member_access ON public.invoice_payment_history
  FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS invoice_disputes_member_access ON public.invoice_disputes;
CREATE POLICY invoice_disputes_member_access ON public.invoice_disputes
  FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

COMMIT;
