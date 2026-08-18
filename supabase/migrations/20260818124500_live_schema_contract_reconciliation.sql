-- Reconcile legacy live-schema constraints with the canonical launch contract.
-- This migration is intentionally narrow: it does not backfill jobs, bids or
-- assignments and it does not change finance data.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Fleet Company quotes are commercial company bids and intentionally have no
-- named execution driver at quote time. Legacy bidder_id is a driver FK, so it
-- must be nullable for that valid path. Named-driver quotes still populate it.
ALTER TABLE public.job_bids
  ALTER COLUMN bidder_id DROP NOT NULL;

-- Preserve explicit canonical fields from server-side quote boundaries. The
-- old trigger unconditionally replaced them from auth.uid(), which is NULL for
-- service-role server calls and therefore broke the server mutation path.
CREATE OR REPLACE FUNCTION public.fn_job_bids_autofill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_driver_id uuid;
BEGIN
  IF NEW.bidder_user_id IS NULL THEN
    NEW.bidder_user_id := v_actor;
  ELSIF v_actor IS NOT NULL AND NEW.bidder_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Bidder user identity does not match the authenticated actor.' USING ERRCODE = '42501';
  END IF;

  IF NEW.bidder_company_id IS NULL THEN
    NEW.bidder_company_id := NEW.company_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := NEW.bidder_company_id;
  END IF;

  -- Authenticated legacy direct driver inserts may omit company/driver fields.
  -- Resolve them only for a real auth.uid(); service-role calls must provide
  -- their explicit server-verified identity instead of being reinterpreted.
  IF v_actor IS NOT NULL AND NEW.bidder_company_id IS NULL THEN
    SELECT cm.company_id
      INTO v_company_id
    FROM public.company_memberships cm
    WHERE cm.user_id = v_actor
      AND cm.status = 'active'
    ORDER BY cm.created_at DESC NULLS LAST
    LIMIT 1;

    NEW.bidder_company_id := v_company_id;
    NEW.company_id := COALESCE(NEW.company_id, v_company_id);
  END IF;

  IF v_actor IS NOT NULL AND NEW.bidder_driver_id IS NULL THEN
    SELECT d.id
      INTO v_driver_id
    FROM public.drivers d
    WHERE d.user_id = v_actor
      AND d.company_id = NEW.bidder_company_id
      AND lower(COALESCE(d.status::text, 'active')) = 'active'
      AND COALESCE(d.is_active, true) = true
    ORDER BY d.created_at DESC NULLS LAST, d.id
    LIMIT 1;

    IF v_driver_id IS NOT NULL THEN
      NEW.bidder_driver_id := v_driver_id;
    END IF;
  END IF;

  -- bidder_id is the legacy driver FK in the live schema. Never store a user id
  -- there. Company-only bids legitimately leave it NULL.
  IF NEW.bidder_driver_id IS NOT NULL THEN
    NEW.bidder_id := NEW.bidder_driver_id;
  ELSE
    NEW.bidder_id := NULL;
  END IF;

  IF NEW.bidder_user_id IS NULL THEN
    RAISE EXCEPTION 'Bidder user identity is required.' USING ERRCODE = '23502';
  END IF;
  IF NEW.bidder_company_id IS NULL OR NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Bidder company identity is required.' USING ERRCODE = '23502';
  END IF;
  IF COALESCE(NEW.bid_price_gbp, NEW.amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Bid price cannot be null or non-positive.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- Live XDrive still has the early MVP lifecycle trigger. Replace its old
-- allocated->in_transit contract with the established canonical lifecycle and
-- make POD checks JSONB-aware. Atomic RPCs remain the primary mutation path;
-- this trigger is a non-bypassable safety net for every writer.
CREATE OR REPLACE FUNCTION public.fn_jobs_mvp_guardrails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed_next text[];
  v_carrier_company_id uuid;
  v_issues text[];
  v_delivery_photo_count integer := 0;
  v_pod_photo_count integer := 0;
  v_signature_text text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_allowed_next := CASE lower(COALESCE(OLD.status::text, ''))
      WHEN 'draft' THEN ARRAY['posted', 'cancelled', 'disputed']
      WHEN 'open' THEN ARRAY['posted', 'allocated', 'cancelled', 'disputed']
      WHEN 'received' THEN ARRAY['posted', 'allocated', 'cancelled', 'disputed']
      WHEN 'posted' THEN ARRAY['quoted', 'awarded', 'allocated', 'cancelled', 'disputed']
      WHEN 'quoted' THEN ARRAY['posted', 'awarded', 'allocated', 'cancelled', 'disputed']
      WHEN 'awarded' THEN ARRAY['allocated', 'on_my_way', 'cancelled', 'disputed']
      WHEN 'allocated' THEN ARRAY['on_my_way', 'cancelled', 'disputed']
      WHEN 'accepted' THEN ARRAY['on_my_way', 'cancelled', 'disputed']
      WHEN 'on_my_way' THEN ARRAY['on_site_pickup', 'cancelled', 'disputed']
      WHEN 'on_my_way_to_pickup' THEN ARRAY['on_site_pickup', 'cancelled', 'disputed']
      WHEN 'arrived_pickup' THEN ARRAY['loaded', 'cancelled', 'disputed']
      WHEN 'on_site_pickup' THEN ARRAY['loaded', 'cancelled', 'disputed']
      WHEN 'loaded' THEN ARRAY['in_transit', 'cancelled', 'disputed']
      WHEN 'collected' THEN ARRAY['in_transit', 'cancelled', 'disputed']
      WHEN 'in_transit' THEN ARRAY['on_site_delivery', 'cancelled', 'disputed']
      WHEN 'on_my_way_to_delivery' THEN ARRAY['on_site_delivery', 'cancelled', 'disputed']
      WHEN 'arrived_delivery' THEN ARRAY['delivered', 'cancelled', 'disputed']
      WHEN 'on_site_delivery' THEN ARRAY['delivered', 'cancelled', 'disputed']
      WHEN 'delivered' THEN ARRAY['completed']
      WHEN 'completed' THEN ARRAY[]::text[]
      WHEN 'invoiced' THEN ARRAY['paid']
      WHEN 'paid' THEN ARRAY[]::text[]
      WHEN 'cancelled' THEN ARRAY[]::text[]
      WHEN 'disputed' THEN ARRAY[]::text[]
      ELSE ARRAY[]::text[]
    END;

    IF NOT (lower(COALESCE(NEW.status::text, '')) = ANY (v_allowed_next)) THEN
      RAISE EXCEPTION 'Invalid job status transition: % -> %', OLD.status, NEW.status
        USING ERRCODE = '23514';
    END IF;

    IF lower(COALESCE(NEW.status::text, '')) = 'loaded'
       AND NULLIF(btrim(COALESCE(NEW.collection_photo_url, '')), '') IS NULL THEN
      RAISE EXCEPTION 'A loading photo is required before marking the job loaded.'
        USING ERRCODE = '23514';
    END IF;

    IF lower(COALESCE(NEW.status::text, '')) = 'delivered'
       AND COALESCE(NEW.pod_required, true) THEN
      IF jsonb_typeof(COALESCE(NEW.delivery_photos, '[]'::jsonb)) = 'array' THEN
        v_delivery_photo_count := jsonb_array_length(COALESCE(NEW.delivery_photos, '[]'::jsonb));
      END IF;
      IF jsonb_typeof(COALESCE(NEW.pod_photos, '[]'::jsonb)) = 'array' THEN
        v_pod_photo_count := jsonb_array_length(COALESCE(NEW.pod_photos, '[]'::jsonb));
      END IF;

      IF v_delivery_photo_count + v_pod_photo_count < 1 THEN
        RAISE EXCEPTION 'At least one delivery photo or POD document is required before delivery.'
          USING ERRCODE = '23514';
      END IF;

      IF NEW.delivery_signature_data IS NULL OR NEW.delivery_signature_data = 'null'::jsonb THEN
        RAISE EXCEPTION 'Recipient signature is required before delivery.' USING ERRCODE = '23514';
      END IF;
      IF jsonb_typeof(NEW.delivery_signature_data) = 'string' THEN
        v_signature_text := NEW.delivery_signature_data #>> '{}';
        IF NULLIF(btrim(COALESCE(v_signature_text, '')), '') IS NULL THEN
          RAISE EXCEPTION 'Recipient signature is required before delivery.' USING ERRCODE = '23514';
        END IF;
      END IF;
      IF NULLIF(btrim(COALESCE(NEW.client_signature_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Recipient name is required before delivery.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF NEW.exchange_visibility = 'exchange'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.exchange_visibility, '') <> 'exchange') THEN
    v_issues := public.company_compliance_issues(NEW.company_id, 'publish');
    IF COALESCE(array_length(v_issues, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Compliance blocked publish action: %', array_to_string(v_issues, ' ')
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    IF lower(COALESCE(NEW.status::text, '')) IN (
      'awarded', 'allocated', 'on_my_way', 'on_site_pickup', 'loaded',
      'in_transit', 'on_site_delivery', 'delivered', 'completed'
    ) THEN
      v_carrier_company_id := COALESCE(NEW.awarded_carrier_company_id, NEW.assigned_company_id, NEW.company_id);
      v_issues := public.company_compliance_issues(v_carrier_company_id, 'execution');
      IF COALESCE(array_length(v_issues, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Compliance blocked execution action: %', array_to_string(v_issues, ' ')
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The live CHECK recognises only the execution UI labels and rejects legitimate
-- allocation/award/audit events. Keep event_type as text, but align the CHECK to
-- the complete established XDrive vocabulary used by the current functions.
ALTER TABLE public.job_tracking_events
  DROP CONSTRAINT IF EXISTS job_tracking_events_event_type_check;

ALTER TABLE public.job_tracking_events
  ADD CONSTRAINT job_tracking_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'created',
    'awarded',
    'allocated',
    'driver_en_route',
    'on_my_way_to_pickup',
    'arrived_pickup',
    'on_site_pickup',
    'collected',
    'loaded',
    'in_transit',
    'on_my_way_to_delivery',
    'arrived_delivery',
    'on_site_delivery',
    'delivered',
    'completed',
    'failed',
    'cancelled',
    'note'
  ]));

COMMENT ON COLUMN public.job_bids.bidder_id IS
  'Legacy named-driver FK. NULL for Fleet Company bids without a named driver; canonical identity is bidder_user_id/company_id/bidder_driver_id.';

COMMENT ON FUNCTION public.fn_jobs_mvp_guardrails() IS
  'Canonical non-bypassable job lifecycle/compliance/POD safety net aligned with XDrive current_status/status execution flow and JSONB evidence storage.';

NOTIFY pgrst, 'reload schema';
COMMIT;
