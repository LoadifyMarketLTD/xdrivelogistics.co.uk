BEGIN;

CREATE TABLE IF NOT EXISTS public.transport_buyer_risk_controls (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  risk_mode text NOT NULL DEFAULT 'restricted' CHECK (risk_mode IN ('restricted','cleared','blocked')),
  max_active_commitments integer NOT NULL DEFAULT 3 CHECK (max_active_commitments >= 0 AND max_active_commitments <= 10000),
  max_outstanding_exposure_gbp numeric(12,2) NOT NULL DEFAULT 2500 CHECK (max_outstanding_exposure_gbp >= 0),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transport_buyer_risk_controls_review CHECK (
    (reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

ALTER TABLE public.transport_buyer_risk_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transport_buyer_risk_controls FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transport_buyer_risk_controls TO service_role;

CREATE TABLE IF NOT EXISTS public.transport_buyer_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('risk_reviewed','publish_blocked','award_blocked')),
  previous_mode text,
  new_mode text,
  active_commitments integer,
  outstanding_exposure_gbp numeric(12,2),
  projected_exposure_gbp numeric(12,2),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transport_buyer_risk_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transport_buyer_risk_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.transport_buyer_risk_events TO service_role;
CREATE INDEX IF NOT EXISTS transport_buyer_risk_events_company_created_idx
  ON public.transport_buyer_risk_events(company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_transport_buyer_risk_snapshot(
  p_company_id uuid,
  p_projected_amount_gbp numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_control public.transport_buyer_risk_controls%ROWTYPE;
  v_paid_invoice_count integer := 0;
  v_active_commitments integer := 0;
  v_outstanding numeric(12,2) := 0;
  v_projected numeric(12,2) := GREATEST(COALESCE(p_projected_amount_gbp,0),0)::numeric(12,2);
  v_effective_mode text;
  v_is_new_buyer boolean;
  v_allowed boolean;
  v_reason text := NULL;
  v_max_active integer := 3;
  v_max_exposure numeric(12,2) := 2500;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Transport buyer company is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_control
  FROM public.transport_buyer_risk_controls
  WHERE company_id = p_company_id;

  IF FOUND THEN
    v_max_active := v_control.max_active_commitments;
    v_max_exposure := v_control.max_outstanding_exposure_gbp;
  END IF;

  SELECT count(*)::integer
  INTO v_paid_invoice_count
  FROM public.invoices invoice
  WHERE invoice.buyer_company_id = p_company_id
    AND lower(COALESCE(invoice.payment_status::text,'')) = 'paid';

  v_is_new_buyer := v_paid_invoice_count = 0;
  v_effective_mode := CASE
    WHEN v_control.risk_mode = 'blocked' THEN 'blocked'
    WHEN v_control.risk_mode = 'cleared' THEN 'cleared'
    WHEN v_control.risk_mode = 'restricted' THEN 'restricted'
    WHEN v_is_new_buyer THEN 'restricted'
    ELSE 'cleared'
  END;

  SELECT count(*)::integer
  INTO v_active_commitments
  FROM public.job_commercial_agreements_effective agreement
  JOIN public.jobs job ON job.id = agreement.job_id
  WHERE agreement.buyer_company_id = p_company_id
    AND agreement.agreement_status = 'accepted'
    AND lower(COALESCE(NULLIF(job.current_status,''),NULLIF(job.status,''),'')) NOT IN ('delivered','completed','cancelled','expired');

  SELECT COALESCE(sum(GREATEST(
    COALESCE(agreement.agreed_gross_amount, agreement.agreed_amount, 0)
    - COALESCE(payment.paid_amount,0),
    0
  )),0)::numeric(12,2)
  INTO v_outstanding
  FROM public.job_commercial_agreements_effective agreement
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(history.amount),0) AS paid_amount
    FROM public.invoices invoice
    JOIN public.invoice_payment_history history ON history.invoice_id = invoice.id
    WHERE invoice.commercial_agreement_id = agreement.id
  ) payment ON true
  WHERE agreement.buyer_company_id = p_company_id
    AND agreement.agreement_status = 'accepted';

  IF v_effective_mode = 'blocked' THEN
    v_allowed := false;
    v_reason := 'Transport buyer has been blocked by platform risk governance.';
  ELSIF v_effective_mode = 'cleared' THEN
    v_allowed := true;
  ELSIF v_active_commitments >= v_max_active THEN
    v_allowed := false;
    v_reason := format('New transport buyer active commitment limit reached (%s).', v_max_active);
  ELSIF v_outstanding + v_projected > v_max_exposure THEN
    v_allowed := false;
    v_reason := format('New transport buyer exposure limit would be exceeded (£%s).', trim(to_char(v_max_exposure,'FM9999999990.00')));
  ELSE
    v_allowed := true;
  END IF;

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'risk_mode', v_effective_mode,
    'configured_mode', COALESCE(v_control.risk_mode,'restricted'),
    'is_new_buyer', v_is_new_buyer,
    'paid_invoice_count', v_paid_invoice_count,
    'active_commitments', v_active_commitments,
    'outstanding_exposure_gbp', v_outstanding,
    'projected_amount_gbp', v_projected,
    'projected_exposure_gbp', v_outstanding + v_projected,
    'max_active_commitments', v_max_active,
    'max_outstanding_exposure_gbp', v_max_exposure,
    'allowed', v_allowed,
    'reason', v_reason,
    'reviewed_by', v_control.reviewed_by,
    'reviewed_at', v_control.reviewed_at,
    'review_note', v_control.review_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_transport_buyer_risk_snapshot(uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transport_buyer_risk_snapshot(uuid,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_guard_transport_buyer_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_status text := CASE WHEN TG_OP='UPDATE' THEN lower(COALESCE(NULLIF(OLD.current_status,''),NULLIF(OLD.status,''),'')) ELSE '' END;
  v_new_status text := lower(COALESCE(NULLIF(NEW.current_status,''),NULLIF(NEW.status,''),''));
  v_snapshot jsonb;
BEGIN
  IF v_new_status <> 'posted' OR (TG_OP='UPDATE' AND v_old_status='posted') THEN
    RETURN NEW;
  END IF;

  v_snapshot := public.fn_transport_buyer_risk_snapshot(NEW.company_id,0);
  IF COALESCE((v_snapshot->>'allowed')::boolean,false) IS NOT TRUE THEN
    INSERT INTO public.transport_buyer_risk_events(
      company_id,event_type,active_commitments,outstanding_exposure_gbp,projected_exposure_gbp,reason,metadata
    ) VALUES (
      NEW.company_id,'publish_blocked',
      COALESCE((v_snapshot->>'active_commitments')::integer,0),
      COALESCE((v_snapshot->>'outstanding_exposure_gbp')::numeric,0),
      COALESCE((v_snapshot->>'projected_exposure_gbp')::numeric,0),
      v_snapshot->>'reason',v_snapshot
    );
    RAISE EXCEPTION '%', COALESCE(v_snapshot->>'reason','Transport buyer risk limit prevents new published work.')
      USING ERRCODE = 'P0001', HINT = 'TRANSPORT_BUYER_RISK_LIMIT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_transport_buyer_publish ON public.jobs;
CREATE TRIGGER trg_guard_transport_buyer_publish
BEFORE INSERT OR UPDATE OF status,current_status ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_transport_buyer_publish();

CREATE OR REPLACE FUNCTION public.fn_guard_transport_buyer_booking_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  v_snapshot := public.fn_transport_buyer_risk_snapshot(NEW.buyer_company_id,NEW.quoted_amount);
  IF COALESCE((v_snapshot->>'allowed')::boolean,false) IS NOT TRUE THEN
    INSERT INTO public.transport_buyer_risk_events(
      company_id,actor_user_id,event_type,active_commitments,outstanding_exposure_gbp,projected_exposure_gbp,reason,metadata
    ) VALUES (
      NEW.buyer_company_id,NEW.offered_by,'award_blocked',
      COALESCE((v_snapshot->>'active_commitments')::integer,0),
      COALESCE((v_snapshot->>'outstanding_exposure_gbp')::numeric,0),
      COALESCE((v_snapshot->>'projected_exposure_gbp')::numeric,0),
      v_snapshot->>'reason',v_snapshot || jsonb_build_object('job_id',NEW.job_id,'bid_id',NEW.bid_id)
    );
    RAISE EXCEPTION '%', COALESCE(v_snapshot->>'reason','Transport buyer risk limit prevents this award.')
      USING ERRCODE = 'P0001', HINT = 'TRANSPORT_BUYER_RISK_LIMIT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_transport_buyer_booking_offer ON public.job_booking_offers;
CREATE TRIGGER trg_guard_transport_buyer_booking_offer
BEFORE INSERT ON public.job_booking_offers
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_transport_buyer_booking_offer();

CREATE OR REPLACE FUNCTION public.fn_review_transport_buyer_risk(
  p_company_id uuid,
  p_actor_user_id uuid,
  p_risk_mode text,
  p_max_active_commitments integer,
  p_max_outstanding_exposure_gbp numeric,
  p_reason text
)
RETURNS public.transport_buyer_risk_controls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old public.transport_buyer_risk_controls%ROWTYPE;
  v_new public.transport_buyer_risk_controls%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(p_reason,'')),'');
BEGIN
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.user_id=p_actor_user_id
      AND lower(COALESCE(profile.role::text,'')) = 'owner'
      AND lower(COALESCE(profile.status::text,'')) = 'active'
  ) THEN
    RAISE EXCEPTION 'Platform Owner authorisation is required for transport buyer risk review.' USING ERRCODE='42501';
  END IF;
  IF p_risk_mode NOT IN ('restricted','cleared','blocked') THEN
    RAISE EXCEPTION 'Invalid transport buyer risk mode.' USING ERRCODE='22023';
  END IF;
  IF p_max_active_commitments < 0 OR p_max_outstanding_exposure_gbp < 0 THEN
    RAISE EXCEPTION 'Transport buyer risk limits cannot be negative.' USING ERRCODE='22023';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 5 THEN
    RAISE EXCEPTION 'Transport buyer risk review requires a reason of at least 5 characters.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_old FROM public.transport_buyer_risk_controls WHERE company_id=p_company_id FOR UPDATE;
  INSERT INTO public.transport_buyer_risk_controls(
    company_id,risk_mode,max_active_commitments,max_outstanding_exposure_gbp,reviewed_by,reviewed_at,review_note,updated_at
  ) VALUES (
    p_company_id,p_risk_mode,p_max_active_commitments,p_max_outstanding_exposure_gbp,p_actor_user_id,now(),v_reason,now()
  )
  ON CONFLICT(company_id) DO UPDATE SET
    risk_mode=EXCLUDED.risk_mode,
    max_active_commitments=EXCLUDED.max_active_commitments,
    max_outstanding_exposure_gbp=EXCLUDED.max_outstanding_exposure_gbp,
    reviewed_by=EXCLUDED.reviewed_by,
    reviewed_at=EXCLUDED.reviewed_at,
    review_note=EXCLUDED.review_note,
    updated_at=now()
  RETURNING * INTO v_new;

  INSERT INTO public.transport_buyer_risk_events(
    company_id,actor_user_id,event_type,previous_mode,new_mode,reason,metadata
  ) VALUES (
    p_company_id,p_actor_user_id,'risk_reviewed',v_old.risk_mode,v_new.risk_mode,v_reason,
    jsonb_build_object('max_active_commitments',v_new.max_active_commitments,'max_outstanding_exposure_gbp',v_new.max_outstanding_exposure_gbp)
  );
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_review_transport_buyer_risk(uuid,uuid,text,integer,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_review_transport_buyer_risk(uuid,uuid,text,integer,numeric,text) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
