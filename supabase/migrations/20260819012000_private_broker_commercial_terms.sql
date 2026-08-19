-- P0 privacy boundary: broker customer revenue and carrier target cost are
-- commercially private to the posting broker company. They must not live in
-- the operational jobs row because assigned drivers and awarded carriers have
-- legitimate post-award row access for execution.
--
-- This migration creates a service-role-only store, migrates verified Broker
-- values out of jobs, and adds database backstops so future Broker INSERT/UPDATE
-- operations cannot reintroduce those private values into the raw jobs row.
--
-- Repository migration only. Apply to Production only during the deliberate
-- XDrive production reconciliation phase after local/staging validation.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.job_private_commercial_terms (
  job_id uuid PRIMARY KEY,
  owner_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_price numeric(14,2),
  target_carrier_cost numeric(14,2),
  currency text NOT NULL DEFAULT 'GBP',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_private_commercial_terms_job_id_fkey
    FOREIGN KEY (job_id)
    REFERENCES public.jobs(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT job_private_commercial_terms_customer_price_nonnegative
    CHECK (customer_price IS NULL OR customer_price >= 0),
  CONSTRAINT job_private_commercial_terms_target_cost_nonnegative
    CHECK (target_carrier_cost IS NULL OR target_carrier_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_job_private_commercial_terms_owner_company
  ON public.job_private_commercial_terms(owner_company_id);

ALTER TABLE public.job_private_commercial_terms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_private_commercial_terms FROM PUBLIC;
REVOKE ALL ON TABLE public.job_private_commercial_terms FROM anon;
REVOKE ALL ON TABLE public.job_private_commercial_terms FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_private_commercial_terms TO service_role;

COMMENT ON TABLE public.job_private_commercial_terms IS
  'Server-only Broker commercial terms. Never expose customer revenue or target carrier cost through raw jobs/Marketplace/Driver projections.';

CREATE OR REPLACE FUNCTION public.xdrive_safe_jsonb(p_value text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::jsonb;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.xdrive_safe_numeric(p_value text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_value numeric;
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  v_value := p_value::numeric;
  IF v_value < 0 THEN
    RETURN NULL;
  END IF;
  RETURN v_value;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.xdrive_is_broker_commercial_job(
  p_company_id uuid,
  p_created_by uuid,
  p_load_details text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_details jsonb := public.xdrive_safe_jsonb(p_load_details);
  v_source text := lower(COALESCE(v_details->>'source', ''));
  v_company_type text;
  v_creator_role text;
BEGIN
  SELECT lower(COALESCE(c.company_type::text, ''))
  INTO v_company_type
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF p_created_by IS NOT NULL THEN
    SELECT lower(COALESCE(p.role::text, ''))
    INTO v_creator_role
    FROM public.profiles p
    WHERE p.user_id = p_created_by;
  END IF;

  RETURN v_source LIKE '%broker%'
    OR COALESCE(v_details ? 'targetCarrierCost', false)
    OR COALESCE(v_company_type LIKE '%broker%', false)
    OR COALESCE(v_creator_role = 'broker', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.xdrive_upsert_private_broker_terms(
  p_job_id uuid,
  p_company_id uuid,
  p_customer_price numeric,
  p_target_carrier_cost numeric,
  p_currency text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.job_private_commercial_terms (
    job_id,
    owner_company_id,
    customer_price,
    target_carrier_cost,
    currency,
    created_at,
    updated_at
  )
  VALUES (
    p_job_id,
    p_company_id,
    CASE WHEN p_customer_price IS NULL OR p_customer_price < 0 THEN NULL ELSE p_customer_price END,
    CASE WHEN p_target_carrier_cost IS NULL OR p_target_carrier_cost < 0 THEN NULL ELSE p_target_carrier_cost END,
    COALESCE(NULLIF(btrim(p_currency), ''), 'GBP'),
    now(),
    now()
  )
  ON CONFLICT (job_id) DO UPDATE
  SET owner_company_id = EXCLUDED.owner_company_id,
      customer_price = COALESCE(EXCLUDED.customer_price, public.job_private_commercial_terms.customer_price),
      target_carrier_cost = COALESCE(EXCLUDED.target_carrier_cost, public.job_private_commercial_terms.target_carrier_cost),
      currency = COALESCE(NULLIF(EXCLUDED.currency, ''), public.job_private_commercial_terms.currency),
      updated_at = now();
END;
$$;

-- Backfill only rows that can be positively identified as Broker commercial
-- jobs by their source/legacy target marker, owning company type, or creator's
-- verified Broker profile role.
DO $$
DECLARE
  r record;
  v_details jsonb;
  v_target numeric;
  v_sanitized text;
BEGIN
  FOR r IN
    SELECT j.id, j.company_id, j.created_by, j.budget_amount, j.currency, j.load_details
    FROM public.jobs j
  LOOP
    IF NOT public.xdrive_is_broker_commercial_job(r.company_id, r.created_by, r.load_details::text) THEN
      CONTINUE;
    END IF;

    v_details := public.xdrive_safe_jsonb(r.load_details::text);
    v_target := public.xdrive_safe_numeric(v_details->>'targetCarrierCost');

    PERFORM public.xdrive_upsert_private_broker_terms(
      r.id,
      r.company_id,
      r.budget_amount,
      v_target,
      r.currency::text
    );

    v_sanitized := CASE
      WHEN v_details IS NULL THEN r.load_details::text
      ELSE (v_details - 'targetCarrierCost')::text
    END;

    UPDATE public.jobs
    SET budget_amount = NULL,
        load_details = v_sanitized
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- If a caller later attempts to write private Broker values back into an
-- existing jobs row, capture them server-side and sanitize NEW before storage.
CREATE OR REPLACE FUNCTION public.xdrive_privateize_broker_terms_before_job_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_details jsonb;
  v_target numeric;
  v_has_private_input boolean := false;
BEGIN
  IF NOT (
    public.xdrive_is_broker_commercial_job(NEW.company_id, NEW.created_by, NEW.load_details::text)
    OR public.xdrive_is_broker_commercial_job(OLD.company_id, OLD.created_by, OLD.load_details::text)
  ) THEN
    RETURN NEW;
  END IF;

  v_details := public.xdrive_safe_jsonb(NEW.load_details::text);
  v_target := public.xdrive_safe_numeric(v_details->>'targetCarrierCost');
  v_has_private_input := NEW.budget_amount IS NOT NULL
    OR COALESCE(v_details ? 'targetCarrierCost', false);

  IF v_has_private_input THEN
    PERFORM public.xdrive_upsert_private_broker_terms(
      NEW.id,
      NEW.company_id,
      NEW.budget_amount,
      v_target,
      NEW.currency::text
    );
  END IF;

  NEW.budget_amount := NULL;
  IF v_details IS NOT NULL AND COALESCE(v_details ? 'targetCarrierCost', false) THEN
    NEW.load_details := (v_details - 'targetCarrierCost')::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_privateize_broker_terms_before_job_update ON public.jobs;
CREATE TRIGGER trg_privateize_broker_terms_before_job_update
BEFORE UPDATE OF budget_amount, load_details, company_id, currency, created_by ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.xdrive_privateize_broker_terms_before_job_update();

-- Canonical create route currently submits customerPrice/targetCarrierCost as
-- part of the job INSERT. The job UUID default is available to a BEFORE INSERT
-- trigger, while the deferred FK lets the private row be written before its
-- parent jobs row. This prevents any stored/raw jobs version from ever carrying
-- Broker customer revenue or target carrier cost, even transiently.
CREATE OR REPLACE FUNCTION public.xdrive_privateize_broker_terms_before_job_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_details jsonb;
  v_target numeric;
BEGIN
  IF NOT public.xdrive_is_broker_commercial_job(NEW.company_id, NEW.created_by, NEW.load_details::text) THEN
    RETURN NEW;
  END IF;

  v_details := public.xdrive_safe_jsonb(NEW.load_details::text);
  v_target := public.xdrive_safe_numeric(v_details->>'targetCarrierCost');

  PERFORM public.xdrive_upsert_private_broker_terms(
    NEW.id,
    NEW.company_id,
    NEW.budget_amount,
    v_target,
    NEW.currency::text
  );

  NEW.budget_amount := NULL;
  IF v_details IS NOT NULL AND COALESCE(v_details ? 'targetCarrierCost', false) THEN
    NEW.load_details := (v_details - 'targetCarrierCost')::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_privateize_broker_terms_before_job_insert ON public.jobs;
CREATE TRIGGER trg_privateize_broker_terms_before_job_insert
BEFORE INSERT ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.xdrive_privateize_broker_terms_before_job_insert();

REVOKE ALL ON FUNCTION public.xdrive_safe_jsonb(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xdrive_safe_numeric(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xdrive_is_broker_commercial_job(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xdrive_upsert_private_broker_terms(uuid, uuid, numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xdrive_privateize_broker_terms_before_job_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xdrive_privateize_broker_terms_before_job_insert() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.xdrive_is_broker_commercial_job(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.xdrive_upsert_private_broker_terms(uuid, uuid, numeric, numeric, text) TO service_role;

COMMENT ON FUNCTION public.xdrive_privateize_broker_terms_before_job_insert() IS
  'Atomic Broker privacy backstop: stores customer revenue/target carrier cost privately and scrubs the jobs row before it is inserted.';
COMMENT ON FUNCTION public.xdrive_privateize_broker_terms_before_job_update() IS
  'Prevents later UPDATE operations from reintroducing Broker customer revenue/target carrier cost into the operational jobs row.';

NOTIFY pgrst, 'reload schema';
COMMIT;
