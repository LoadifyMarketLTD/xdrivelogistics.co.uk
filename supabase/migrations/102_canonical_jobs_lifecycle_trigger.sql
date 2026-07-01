-- Migration 102: Canonical jobs lifecycle trigger reconciliation
-- Keeps a single lifecycle guard trigger on public.jobs and removes legacy overlap.
BEGIN;

DROP TRIGGER IF EXISTS trg_validate_job_status_transition ON public.jobs;
DROP FUNCTION IF EXISTS public.validate_job_status_transition();

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
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_allowed_next := CASE OLD.status::text
      WHEN 'draft' THEN ARRAY['posted', 'cancelled', 'disputed']
      WHEN 'posted' THEN ARRAY['quoted', 'awarded', 'allocated', 'cancelled', 'disputed']
      WHEN 'quoted' THEN ARRAY['awarded', 'posted', 'cancelled', 'disputed']
      WHEN 'awarded' THEN ARRAY['allocated', 'cancelled', 'disputed']
      WHEN 'allocated' THEN ARRAY['collected', 'in_transit', 'cancelled', 'disputed']
      WHEN 'collected' THEN ARRAY['in_transit', 'cancelled', 'disputed']
      WHEN 'in_transit' THEN ARRAY['delivered', 'cancelled', 'disputed']
      WHEN 'delivered' THEN ARRAY['invoiced']
      WHEN 'invoiced' THEN ARRAY['paid']
      WHEN 'paid' THEN ARRAY[]::text[]
      WHEN 'cancelled' THEN ARRAY[]::text[]
      WHEN 'disputed' THEN ARRAY[]::text[]
      ELSE ARRAY[]::text[]
    END;

    IF NOT (NEW.status::text = ANY (v_allowed_next)) THEN
      RAISE EXCEPTION 'Invalid job status transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status::text IN ('collected', 'in_transit', 'delivered')
       AND NEW.assigned_driver_id IS NULL
    THEN
      RAISE EXCEPTION 'Job cannot move to % without an assigned driver.', NEW.status;
    END IF;

    IF NEW.status::text = 'delivered' THEN
      IF (NEW.delivery_photos IS NULL OR jsonb_array_length(to_jsonb(NEW.delivery_photos)) = 0)
         AND (NEW.delivery_signature_data IS NULL OR NEW.delivery_signature_data = '')
      THEN
        RAISE EXCEPTION 'Job cannot be marked delivered without a delivery photo or signature.';
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
    IF NEW.status::text IN ('awarded', 'allocated', 'collected', 'in_transit', 'delivered') THEN
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

COMMIT;
