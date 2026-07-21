-- Keep buyer load publication separate from carrier compliance.
-- Customers and brokers post jobs; driver/vehicle compliance belongs to the
-- carrier at bid, award and execution time.
-- Also align the legacy guardrail with the canonical driver lifecycle and keep
-- jobs.current_status synchronized with jobs.status.

BEGIN;

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
  IF TG_OP = 'INSERT' THEN
    NEW.current_status := coalesce(nullif(btrim(NEW.current_status), ''), NEW.status::text, 'draft');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_allowed_next := CASE OLD.status::text
      WHEN 'draft' THEN ARRAY['posted', 'cancelled', 'disputed']
      WHEN 'posted' THEN ARRAY['quoted', 'awarded', 'allocated', 'cancelled', 'disputed']
      WHEN 'quoted' THEN ARRAY['posted', 'awarded', 'cancelled', 'disputed']
      WHEN 'awarded' THEN ARRAY['allocated', 'cancelled', 'disputed']
      WHEN 'allocated' THEN ARRAY['on_my_way', 'collected', 'in_transit', 'cancelled', 'disputed']
      WHEN 'on_my_way' THEN ARRAY['on_site_pickup', 'cancelled', 'disputed']
      WHEN 'on_site_pickup' THEN ARRAY['loaded', 'cancelled', 'disputed']
      WHEN 'loaded' THEN ARRAY['in_transit', 'on_site_delivery', 'cancelled', 'disputed']
      WHEN 'collected' THEN ARRAY['in_transit', 'cancelled', 'disputed']
      WHEN 'in_transit' THEN ARRAY['on_site_delivery', 'delivered', 'cancelled', 'disputed']
      WHEN 'on_site_delivery' THEN ARRAY['delivered', 'cancelled', 'disputed']
      WHEN 'delivered' THEN ARRAY['completed', 'invoiced', 'cancelled', 'disputed']
      WHEN 'completed' THEN ARRAY['invoiced', 'disputed']
      WHEN 'invoiced' THEN ARRAY['paid', 'disputed']
      WHEN 'paid' THEN ARRAY[]::text[]
      WHEN 'cancelled' THEN ARRAY[]::text[]
      WHEN 'disputed' THEN ARRAY[]::text[]
      ELSE ARRAY[]::text[]
    END;

    IF NOT (NEW.status::text = ANY (v_allowed_next)) THEN
      RAISE EXCEPTION 'Invalid job status transition: % -> %', OLD.status, NEW.status;
    END IF;

    NEW.current_status := NEW.status::text;
  ELSIF NEW.current_status IS NULL OR btrim(NEW.current_status) = '' THEN
    NEW.current_status := NEW.status::text;
  END IF;

  -- Do not run carrier document checks when a buyer publishes a load.
  -- Bid submission has its own carrier compliance trigger, and award/execution
  -- are checked below against the actual awarded or assigned carrier company.
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)
  THEN
    IF NEW.status::text IN (
      'awarded', 'allocated', 'on_my_way', 'on_site_pickup', 'loaded',
      'collected', 'in_transit', 'on_site_delivery', 'delivered', 'completed'
    ) THEN
      v_carrier_company_id := coalesce(
        NEW.awarded_carrier_company_id,
        NEW.assigned_company_id
      );

      IF v_carrier_company_id IS NOT NULL THEN
        v_issues := public.company_compliance_issues(v_carrier_company_id, 'execution');
        IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
          RAISE EXCEPTION 'Compliance blocked execution action: %', array_to_string(v_issues, ' ');
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_jobs_mvp_guardrails() IS
  'Enforces canonical job transitions, mirrors current_status, and applies carrier compliance only after a carrier is assigned or awarded.';

NOTIFY pgrst, 'reload schema';

COMMIT;
