-- PR #357-compatible Driver execution schema + guardrail reconciliation.
--
-- The approved PR #357 runtime already owns the canonical execution sequence:
--   awarded/allocated -> on_my_way -> on_site_pickup -> loaded -> in_transit
--   -> on_site_delivery -> delivered -> completed
--
-- Historical bootstrap migrations predate that contract. On a clean replay they
-- can leave missing runtime columns, text[]/text POD evidence, enum vocabularies
-- without the native execution states, and two stale transition triggers that
-- reject the current RPC sequence.
--
-- This migration repairs ONLY those physical/runtime prerequisites. It does not
-- change workspace UI, award semantics, invoice creation, RLS or permissions.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- 1. Materialise fields already consumed by the PR #357 server/runtime contract.
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS current_status text,
  ADD COLUMN IF NOT EXISTS assigned_company_id uuid,
  ADD COLUMN IF NOT EXISTS accepted_bid_id uuid,
  ADD COLUMN IF NOT EXISTS pod_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pod_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pod_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS on_my_way_at timestamptz,
  ADD COLUMN IF NOT EXISTS on_site_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS loaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS on_site_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobs'::regclass
      AND conname = 'jobs_assigned_company_id_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_assigned_company_id_fkey
      FOREIGN KEY (assigned_company_id)
      REFERENCES public.companies(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobs'::regclass
      AND conname = 'jobs_accepted_bid_id_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_accepted_bid_id_fkey
      FOREIGN KEY (accepted_bid_id)
      REFERENCES public.job_bids(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.jobs VALIDATE CONSTRAINT jobs_assigned_company_id_fkey;
ALTER TABLE public.jobs VALIDATE CONSTRAINT jobs_accepted_bid_id_fkey;

UPDATE public.jobs
SET current_status = status::text
WHERE current_status IS NULL OR btrim(current_status) = '';

-- Recover execution-company identity only when the linked driver proves it.
UPDATE public.jobs j
SET assigned_company_id = d.company_id
FROM public.drivers d
WHERE j.assigned_company_id IS NULL
  AND j.assigned_driver_id = d.id
  AND d.company_id IS NOT NULL
  AND (
    j.awarded_carrier_company_id IS NULL
    OR j.awarded_carrier_company_id = d.company_id
  );

-- ---------------------------------------------------------------------------
-- 2. Align POD physical types with the already-approved JSONB RPC contract.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_delivery_photos_type text;
  v_signature_type text;
  v_pod_photos_type text;
BEGIN
  SELECT c.data_type INTO v_delivery_photos_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'jobs'
    AND c.column_name = 'delivery_photos';

  IF v_delivery_photos_type = 'ARRAY' THEN
    ALTER TABLE public.jobs
      ALTER COLUMN delivery_photos DROP DEFAULT,
      ALTER COLUMN delivery_photos TYPE jsonb
        USING COALESCE(to_jsonb(delivery_photos), '[]'::jsonb),
      ALTER COLUMN delivery_photos SET DEFAULT '[]'::jsonb;
  ELSIF v_delivery_photos_type IS NULL THEN
    ALTER TABLE public.jobs
      ADD COLUMN delivery_photos jsonb NOT NULL DEFAULT '[]'::jsonb;
  ELSIF v_delivery_photos_type <> 'jsonb' THEN
    RAISE EXCEPTION 'Unsupported jobs.delivery_photos type: %', v_delivery_photos_type
      USING ERRCODE = '42804';
  END IF;

  SELECT c.data_type INTO v_signature_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'jobs'
    AND c.column_name = 'delivery_signature_data';

  IF v_signature_type = 'text' THEN
    ALTER TABLE public.jobs
      ALTER COLUMN delivery_signature_data DROP DEFAULT,
      ALTER COLUMN delivery_signature_data TYPE jsonb
        USING CASE
          WHEN delivery_signature_data IS NULL THEN NULL
          ELSE to_jsonb(delivery_signature_data)
        END;
  ELSIF v_signature_type IS NULL THEN
    ALTER TABLE public.jobs ADD COLUMN delivery_signature_data jsonb;
  ELSIF v_signature_type <> 'jsonb' THEN
    RAISE EXCEPTION 'Unsupported jobs.delivery_signature_data type: %', v_signature_type
      USING ERRCODE = '42804';
  END IF;

  SELECT c.data_type INTO v_pod_photos_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'jobs'
    AND c.column_name = 'pod_photos';

  IF v_pod_photos_type = 'ARRAY' THEN
    ALTER TABLE public.jobs
      ALTER COLUMN pod_photos DROP DEFAULT,
      ALTER COLUMN pod_photos TYPE jsonb
        USING COALESCE(to_jsonb(pod_photos), '[]'::jsonb),
      ALTER COLUMN pod_photos SET DEFAULT '[]'::jsonb;
  ELSIF v_pod_photos_type = 'text' THEN
    ALTER TABLE public.jobs
      ALTER COLUMN pod_photos DROP DEFAULT,
      ALTER COLUMN pod_photos TYPE jsonb
        USING CASE
          WHEN pod_photos IS NULL OR btrim(pod_photos) = '' THEN '[]'::jsonb
          ELSE jsonb_build_array(pod_photos)
        END,
      ALTER COLUMN pod_photos SET DEFAULT '[]'::jsonb;
  ELSIF v_pod_photos_type IS NOT NULL AND v_pod_photos_type <> 'jsonb' THEN
    RAISE EXCEPTION 'Unsupported jobs.pod_photos type: %', v_pod_photos_type
      USING ERRCODE = '42804';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Tracking fields used by the canonical Driver RPC.
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_tracking_events
  ADD COLUMN IF NOT EXISTS event_time timestamptz,
  ADD COLUMN IF NOT EXISTS user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.job_tracking_events'::regclass
      AND conname = 'job_tracking_events_user_id_fkey'
  ) THEN
    ALTER TABLE public.job_tracking_events
      ADD CONSTRAINT job_tracking_events_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.job_tracking_events VALIDATE CONSTRAINT job_tracking_events_user_id_fkey;

-- ---------------------------------------------------------------------------
-- 4. Extend historical enums only where the physical columns still use them.
--    The migration does not convert job status or tracking types wholesale.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_label text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'job_status'
  ) THEN
    FOREACH v_label IN ARRAY ARRAY[
      'on_my_way',
      'on_site_pickup',
      'loaded',
      'on_site_delivery',
      'completed'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        WHERE e.enumtypid = 'public.job_status'::regtype
          AND e.enumlabel = v_label
      ) THEN
        EXECUTE format('ALTER TYPE public.job_status ADD VALUE %L', v_label);
      END IF;
    END LOOP;
  END IF;
END
$$;

DO $$
DECLARE
  v_label text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'tracking_event_type'
  ) THEN
    FOREACH v_label IN ARRAY ARRAY[
      'awarded',
      'on_my_way_to_pickup',
      'on_site_pickup',
      'loaded',
      'on_my_way_to_delivery',
      'on_site_delivery'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        WHERE e.enumtypid = 'public.tracking_event_type'::regtype
          AND e.enumlabel = v_label
      ) THEN
        EXECUTE format('ALTER TYPE public.tracking_event_type ADD VALUE %L', v_label);
      END IF;
    END LOOP;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5. Remove the second historical lifecycle trigger and replace the remaining
--    MVP guard with one DB safety net aligned to the PR #357 execution contract.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_validate_job_status_transition ON public.jobs;

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
      -- Finance remains a separate subsystem, but legacy invoice coupling may
      -- still move status to invoiced. Keep both paths compatible until the
      -- finance trigger is reconciled in its own audited slice.
      WHEN 'delivered' THEN ARRAY['completed', 'invoiced']
      WHEN 'completed' THEN ARRAY['invoiced']
      WHEN 'invoiced' THEN ARRAY['paid', 'completed']
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

      v_signature_text := NULLIF(btrim(COALESCE(NEW.delivery_signature_data #>> '{}', '')), '');

      IF v_delivery_photo_count < 1 THEN
        RAISE EXCEPTION 'At least one delivery photo is required before marking the job delivered.'
          USING ERRCODE = '23514';
      END IF;
      IF v_signature_text IS NULL THEN
        RAISE EXCEPTION 'Recipient signature is required before marking the job delivered.'
          USING ERRCODE = '23514';
      END IF;
      IF NULLIF(btrim(COALESCE(NEW.client_signature_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Recipient name is required before marking the job delivered.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF NEW.exchange_visibility = 'exchange'
     AND (
       TG_OP = 'INSERT'
       OR COALESCE(OLD.exchange_visibility, '') <> 'exchange'
     ) THEN
    v_issues := public.company_compliance_issues(NEW.company_id, 'publish');
    IF COALESCE(array_length(v_issues, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Compliance blocked publish action: %', array_to_string(v_issues, ' ')
        USING ERRCODE = '23514';
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
          USING ERRCODE = '23514';
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

COMMENT ON FUNCTION public.fn_jobs_mvp_guardrails() IS
  'PR357-compatible DB backstop aligned to canonical Driver execution while preserving publish/execution compliance and temporary legacy finance-status compatibility.';

NOTIFY pgrst, 'reload schema';
COMMIT;
