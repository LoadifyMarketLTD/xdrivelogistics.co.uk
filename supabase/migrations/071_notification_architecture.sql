-- Migration 071: Operational notification architecture
-- Creates a notification_events table and DB triggers for key workflow events.
-- The Edge Function supabase/functions/notify-operational-event processes this queue.

BEGIN;

-- ── 1. notification_events table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text NOT NULL,           -- 'job_assigned' | 'bid_accepted' | 'pod_uploaded' | 'job_delivered'
  entity_type   text NOT NULL,           -- 'job' | 'bid'
  entity_id     uuid NOT NULL,
  company_id    uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_user_id uuid,                -- auth.users.id of primary recipient (nullable for broadcast)
  payload       jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS notification_events_status_idx  ON public.notification_events (status, created_at);
CREATE INDEX IF NOT EXISTS notification_events_company_idx ON public.notification_events (company_id);

-- RLS: only service_role (Edge Function) can process; company users can read their own
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_events_select_company
  ON public.notification_events FOR SELECT
  TO authenticated
  USING (company_id = public.auth_company_id());

-- ── 2. Trigger function: fire event on job_assigned ───────────────────────

CREATE OR REPLACE FUNCTION public.fn_notify_job_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_user_id uuid;
BEGIN
  -- Only fire when assigned_driver_id transitions from NULL to non-null
  IF NEW.assigned_driver_id IS NULL OR NEW.assigned_driver_id = OLD.assigned_driver_id THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_driver_user_id
  FROM public.drivers
  WHERE id = NEW.assigned_driver_id
  LIMIT 1;

  INSERT INTO public.notification_events
    (event_type, entity_type, entity_id, company_id, recipient_user_id, payload)
  VALUES (
    'job_assigned',
    'job',
    NEW.id,
    NEW.company_id,
    v_driver_user_id,
    jsonb_build_object(
      'job_id',            NEW.id,
      'company_id',        NEW.company_id,
      'driver_id',         NEW.assigned_driver_id,
      'driver_user_id',    v_driver_user_id,
      'pickup_location',   NEW.pickup_location,
      'delivery_location', NEW.delivery_location,
      'status',            NEW.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_assigned ON public.jobs;
CREATE TRIGGER trg_notify_job_assigned
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_job_assigned();

-- ── 3. Trigger function: fire event on POD uploaded (job delivered) ───────

CREATE OR REPLACE FUNCTION public.fn_notify_pod_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fire when status transitions to 'delivered'
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_events
    (event_type, entity_type, entity_id, company_id, recipient_user_id, payload)
  VALUES (
    'pod_uploaded',
    'job',
    NEW.id,
    NEW.company_id,
    NULL, -- broadcast to company admins
    jsonb_build_object(
      'job_id',            NEW.id,
      'company_id',        NEW.company_id,
      'driver_id',         NEW.assigned_driver_id,
      'pickup_location',   NEW.pickup_location,
      'delivery_location', NEW.delivery_location,
      'has_collection_photo', (NEW.collection_photo_url IS NOT NULL),
      'delivery_photo_count', COALESCE(jsonb_array_length(NEW.delivery_photos), 0)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pod_uploaded ON public.jobs;
CREATE TRIGGER trg_notify_pod_uploaded
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_pod_uploaded();

-- ── 4. Trigger function: fire event on bid accepted ──────────────────────

CREATE OR REPLACE FUNCTION public.fn_notify_bid_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid_amount_gbp numeric;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Canonical monetary field is bid_price_gbp; amount is kept as transition alias.
  v_bid_amount_gbp := COALESCE(NEW.bid_price_gbp, NEW.amount);

  INSERT INTO public.notification_events
    (event_type, entity_type, entity_id, company_id, recipient_user_id, payload)
  VALUES (
    'bid_accepted',
    'bid',
    NEW.id,
    NEW.company_id,
    NEW.bidder_user_id,
    jsonb_build_object(
      'bid_id',    NEW.id,
      'job_id',    NEW.job_id,
      'company_id', NEW.company_id,
      'bidder_user_id', NEW.bidder_user_id,
      'bid_price_gbp', v_bid_amount_gbp,
      'amount', v_bid_amount_gbp,
      'bid_amount', v_bid_amount_gbp
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bid_accepted ON public.job_bids;
CREATE TRIGGER trg_notify_bid_accepted
  AFTER UPDATE ON public.job_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_bid_accepted();

COMMIT;
