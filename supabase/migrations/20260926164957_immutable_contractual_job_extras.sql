BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.driver_job_extras
  ADD COLUMN IF NOT EXISTS decision_company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS contractual_amendment_id uuid REFERENCES public.job_commercial_agreement_amendments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS contractual_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS contractual_snapshot_hash text,
  ADD COLUMN IF NOT EXISTS contractual_snapshot_version integer;

ALTER TABLE public.driver_job_extras
  DROP CONSTRAINT IF EXISTS driver_job_extras_contractual_hash_format;
ALTER TABLE public.driver_job_extras
  ADD CONSTRAINT driver_job_extras_contractual_hash_format CHECK (
    contractual_snapshot_hash IS NULL OR contractual_snapshot_hash ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE public.driver_job_extras
  DROP CONSTRAINT IF EXISTS driver_job_extras_contractual_decision_complete;
ALTER TABLE public.driver_job_extras
  ADD CONSTRAINT driver_job_extras_contractual_decision_complete CHECK (
    (status = 'submitted'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND decision_company_id IS NULL
      AND contractual_amendment_id IS NULL
      AND contractual_snapshot IS NULL
      AND contractual_snapshot_hash IS NULL
      AND contractual_snapshot_version IS NULL)
    OR
    (status = 'rejected'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND decision_company_id IS NOT NULL
      AND contractual_amendment_id IS NULL
      AND contractual_snapshot IS NULL
      AND contractual_snapshot_hash IS NULL
      AND contractual_snapshot_version IS NULL)
    OR
    (status IN ('approved','invoiced')
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND decision_company_id IS NOT NULL
      AND contractual_amendment_id IS NOT NULL
      AND contractual_snapshot IS NOT NULL
      AND contractual_snapshot_hash IS NOT NULL
      AND contractual_snapshot_version IS NOT NULL
      AND contractual_snapshot_version >= 2)
  );

CREATE UNIQUE INDEX IF NOT EXISTS driver_job_extras_contractual_amendment_unique
  ON public.driver_job_extras(contractual_amendment_id)
  WHERE contractual_amendment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_guard_driver_job_extra_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF ROW(
    NEW.job_id, NEW.driver_id, NEW.supplier_company_id, NEW.created_by,
    NEW.extra_type, NEW.description, NEW.amount_gbp, NEW.minutes, NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.job_id, OLD.driver_id, OLD.supplier_company_id, OLD.created_by,
    OLD.extra_type, OLD.description, OLD.amount_gbp, OLD.minutes, OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Execution extra submission content is immutable.' USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'submitted' THEN
    IF NEW.status NOT IN ('approved','rejected') THEN
      RAISE EXCEPTION 'Submitted execution extra may only be approved or rejected.' USING ERRCODE = '23514';
    END IF;
    IF NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL OR NEW.decision_company_id IS NULL THEN
      RAISE EXCEPTION 'Execution extra decision identity and timestamp are required.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'approved' AND (
      NEW.contractual_amendment_id IS NULL OR NEW.contractual_snapshot IS NULL
      OR NEW.contractual_snapshot_hash IS NULL OR NEW.contractual_snapshot_version IS NULL
    ) THEN
      RAISE EXCEPTION 'Approved execution extra requires an immutable contractual snapshot.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'rejected' AND (
      NEW.contractual_amendment_id IS NOT NULL OR NEW.contractual_snapshot IS NOT NULL
      OR NEW.contractual_snapshot_hash IS NOT NULL OR NEW.contractual_snapshot_version IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Rejected execution extra cannot carry an accepted contractual snapshot.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'approved' THEN
    IF NEW.status <> 'invoiced' THEN
      RAISE EXCEPTION 'Approved execution extra may only transition to invoiced.' USING ERRCODE = '23514';
    END IF;
    IF ROW(
      NEW.reviewed_by, NEW.reviewed_at, NEW.review_note, NEW.decision_company_id,
      NEW.contractual_amendment_id, NEW.contractual_snapshot,
      NEW.contractual_snapshot_hash, NEW.contractual_snapshot_version
    ) IS DISTINCT FROM ROW(
      OLD.reviewed_by, OLD.reviewed_at, OLD.review_note, OLD.decision_company_id,
      OLD.contractual_amendment_id, OLD.contractual_snapshot,
      OLD.contractual_snapshot_hash, OLD.contractual_snapshot_version
    ) THEN
      RAISE EXCEPTION 'Approved execution extra contractual evidence is immutable.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Decided or invoiced execution extra is immutable.' USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_driver_job_extra_update ON public.driver_job_extras;
CREATE TRIGGER trg_guard_driver_job_extra_update
BEFORE UPDATE ON public.driver_job_extras
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_driver_job_extra_update();

CREATE OR REPLACE FUNCTION public.fn_block_driver_job_extra_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Execution extra records are immutable and cannot be deleted.' USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_driver_job_extra_delete ON public.driver_job_extras;
CREATE TRIGGER trg_block_driver_job_extra_delete
BEFORE DELETE ON public.driver_job_extras
FOR EACH ROW EXECUTE FUNCTION public.fn_block_driver_job_extra_delete();

CREATE OR REPLACE FUNCTION public.fn_decide_driver_job_extra(
  p_extra_id uuid,
  p_decided_by_user_id uuid,
  p_decided_by_company_id uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS public.driver_job_extras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_extra public.driver_job_extras%ROWTYPE;
  v_agreement record;
  v_amendment public.job_commercial_agreement_amendments%ROWTYPE;
  v_snapshot jsonb;
  v_snapshot_hash text;
  v_next_amount numeric(12,2);
BEGIN
  IF p_action NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'Unsupported execution extra decision.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_extra
  FROM public.driver_job_extras
  WHERE id = p_extra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution extra not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_extra.status <> 'submitted' THEN
    RAISE EXCEPTION 'Execution extra has already been decided.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_agreement
  FROM public.job_commercial_agreements_effective agreement
  WHERE agreement.job_id = v_extra.job_id
    AND agreement.agreement_status = 'accepted'
  ORDER BY agreement.accepted_at DESC, agreement.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accepted commercial agreement not found for execution extra.' USING ERRCODE = '23503';
  END IF;
  IF p_decided_by_company_id <> v_agreement.buyer_company_id THEN
    RAISE EXCEPTION 'Only the contractual transport buyer may decide an execution extra.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships membership
    WHERE membership.user_id = p_decided_by_user_id
      AND membership.company_id = p_decided_by_company_id
      AND membership.status = 'active'
      AND lower(COALESCE(membership.role_in_company::text,'')) IN ('owner','admin','dispatcher')
  ) THEN
    RAISE EXCEPTION 'User is not authorised to decide execution extras for the transport buyer.' USING ERRCODE = '42501';
  END IF;
  IF v_extra.supplier_company_id IS DISTINCT FROM v_agreement.supplier_company_id THEN
    RAISE EXCEPTION 'Execution extra supplier does not match the performing carrier.' USING ERRCODE = '23514';
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.driver_job_extras
    SET status = 'rejected',
        reviewed_by = p_decided_by_user_id,
        reviewed_at = now(),
        review_note = NULLIF(btrim(COALESCE(p_note,'')),''),
        decision_company_id = p_decided_by_company_id,
        updated_at = now()
    WHERE id = v_extra.id
    RETURNING * INTO v_extra;
    RETURN v_extra;
  END IF;

  IF v_extra.created_by IS NULL OR v_extra.supplier_company_id IS NULL THEN
    RAISE EXCEPTION 'Execution extra has no valid proposing identity.' USING ERRCODE = '23514';
  END IF;

  v_snapshot := jsonb_build_object(
    'extra_id', v_extra.id,
    'job_id', v_extra.job_id,
    'driver_id', v_extra.driver_id,
    'supplier_company_id', v_extra.supplier_company_id,
    'extra_type', v_extra.extra_type,
    'description', v_extra.description,
    'amount_gbp', v_extra.amount_gbp,
    'minutes', v_extra.minutes,
    'submitted_at', v_extra.created_at
  );
  v_snapshot_hash := encode(extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');
  v_next_amount := round(v_agreement.agreed_amount + v_extra.amount_gbp, 2);

  INSERT INTO public.job_commercial_agreement_amendments (
    agreement_id,
    proposed_by_user_id,
    proposed_by_company_id,
    reason,
    change_summary,
    effective_agreed_amount,
    currency,
    vat_treatment,
    vat_rate,
    vat_amount,
    effective_gross_amount,
    payment_terms,
    payment_due_days,
    pod_required,
    effective_job_snapshot
  ) VALUES (
    v_agreement.id,
    v_extra.created_by,
    v_extra.supplier_company_id,
    'Execution extra: ' || replace(v_extra.extra_type, '_', ' '),
    jsonb_build_object(
      'execution_extra', v_snapshot,
      'amount', jsonb_build_object('from', v_agreement.agreed_amount, 'to', v_next_amount)
    ),
    v_next_amount,
    v_agreement.currency,
    v_agreement.vat_treatment,
    v_agreement.vat_rate,
    v_agreement.vat_amount,
    v_agreement.agreed_gross_amount,
    v_agreement.payment_terms,
    v_agreement.payment_due_days,
    v_agreement.pod_required,
    v_agreement.job_snapshot
  )
  RETURNING * INTO v_amendment;

  UPDATE public.job_commercial_agreement_amendments
  SET status = 'accepted',
      decided_by_user_id = p_decided_by_user_id,
      decided_by_company_id = p_decided_by_company_id,
      decision_note = NULLIF(btrim(COALESCE(p_note,'')),''),
      decided_at = now()
  WHERE id = v_amendment.id
  RETURNING * INTO v_amendment;

  UPDATE public.driver_job_extras
  SET status = 'approved',
      reviewed_by = p_decided_by_user_id,
      reviewed_at = v_amendment.decided_at,
      review_note = NULLIF(btrim(COALESCE(p_note,'')),''),
      decision_company_id = p_decided_by_company_id,
      contractual_amendment_id = v_amendment.id,
      contractual_snapshot = v_snapshot,
      contractual_snapshot_hash = v_snapshot_hash,
      contractual_snapshot_version = v_amendment.version_number,
      updated_at = now()
  WHERE id = v_extra.id
  RETURNING * INTO v_extra;

  RETURN v_extra;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_decide_driver_job_extra(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_decide_driver_job_extra(uuid,uuid,uuid,text,text) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
