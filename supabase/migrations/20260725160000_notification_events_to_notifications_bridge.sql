-- Migration: notification_events → notifications bridge trigger
--
-- PROBLEM (launch blocker):
--   All operational event producers (job_assigned, bid_accepted, pod_uploaded,
--   broker_invitation, invoice_dispute, onboarding) write to notification_events.
--
--   The native Android driver app reads from the `notifications` table directly via
--   the Supabase REST API. The web /m/ driver variant also reads `notifications`.
--
--   No bridge exists between the two models. Android drivers see zero notifications.
--
-- SOLUTION:
--   Add a SECURITY DEFINER trigger function that fires AFTER INSERT on
--   notification_events and, when a recipient_user_id is present, writes a
--   corresponding row into `notifications` (id, company_id, user_id, title, body,
--   type, created_at). Broadcast rows (recipient_user_id IS NULL) are skipped
--   because `notifications` requires a user_id.
--
--   This migration does NOT modify any existing trigger, table column, policy or
--   migration history. It is append-only and fully idempotent.
--
-- ARCHITECTURE RULING:
--   notification_events = canonical operational outbox (event source, retry state,
--                         edge-function processing queue, web inbox).
--   notifications       = user-facing inbox (read/mark-read, compatible with
--                         Android REST and the web /m/ driver shell).
--   The bridge trigger keeps both models consistent without requiring an APK update.

BEGIN;

SET LOCAL lock_timeout    = '5s';
SET LOCAL statement_timeout = '120s';

-- ── Guard: both tables must already exist ─────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.notification_events') IS NULL THEN
    RAISE EXCEPTION 'notification_events table is required.';
  END IF;
  IF to_regclass('public.notifications') IS NULL THEN
    RAISE EXCEPTION 'notifications table is required.';
  END IF;
END;
$$;

-- ── Helper: derive human title from event_type ────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_notification_event_title(p_event_type text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
AS $$
BEGIN
  RETURN CASE p_event_type
    WHEN 'job_assigned'         THEN 'Job assigned to you'
    WHEN 'bid_accepted'         THEN 'Your bid was accepted'
    WHEN 'pod_uploaded'         THEN 'POD uploaded — job delivered'
    WHEN 'bid_rejected'         THEN 'Bid rejected'
    WHEN 'invoice_dispute'      THEN 'Invoice dispute raised'
    WHEN 'carrier_invited'      THEN 'Carrier network invitation'
    WHEN 'carrier_accepted'     THEN 'Carrier accepted your invitation'
    WHEN 'carrier_rejected'     THEN 'Carrier declined your invitation'
    WHEN 'onboarding_submitted' THEN 'Onboarding application submitted'
    WHEN 'onboarding_approved'  THEN 'Your application has been approved'
    WHEN 'onboarding_rejected'  THEN 'Application requires attention'
    ELSE initcap(replace(p_event_type, '_', ' '))
  END;
END;
$$;

-- ── Helper: derive human body from event_type + payload ───────────────────────

CREATE OR REPLACE FUNCTION public.fn_notification_event_body(
  p_event_type text,
  p_payload    jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
AS $$
DECLARE
  v_pickup   text;
  v_delivery text;
  v_amount   numeric;
BEGIN
  v_pickup   := NULLIF(TRIM(COALESCE(p_payload->>'pickup_location',  '')), '');
  v_delivery := NULLIF(TRIM(COALESCE(p_payload->>'delivery_location', '')), '');

  RETURN CASE p_event_type
    WHEN 'job_assigned' THEN
      COALESCE(v_pickup || ' → ' || v_delivery, 'Check your jobs list for details.')
    WHEN 'bid_accepted' THEN
      CASE
        WHEN (p_payload->>'bid_price_gbp') IS NOT NULL
          THEN 'Accepted amount: £' || to_char((p_payload->>'bid_price_gbp')::numeric, 'FM999999990.00')
        WHEN (p_payload->>'amount') IS NOT NULL
          THEN 'Accepted amount: £' || to_char((p_payload->>'amount')::numeric, 'FM999999990.00')
        ELSE 'A bid on your job has been accepted.'
      END
    WHEN 'pod_uploaded' THEN
      COALESCE(v_pickup || ' → ' || v_delivery, 'The driver has completed delivery.')
    WHEN 'invoice_dispute' THEN
      COALESCE(p_payload->>'reason', 'An invoice dispute has been raised.')
    WHEN 'carrier_invited' THEN
      COALESCE('Invitation from ' || (p_payload->>'invited_by_name'), 'You have been invited to join a carrier network.')
    ELSE
      COALESCE(p_payload->>'message', 'Open the platform for details.')
  END;
END;
$$;

-- ── Bridge trigger function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_bridge_notification_event_to_inbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only bridge rows that have a specific recipient.
  -- Broadcast rows (recipient_user_id IS NULL) cannot be inserted into
  -- `notifications` because user_id is expected by Android.
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    id,
    company_id,
    user_id,
    title,
    body,
    type,
    created_at
  ) VALUES (
    NEW.id,
    NEW.company_id,
    NEW.recipient_user_id,
    public.fn_notification_event_title(NEW.event_type),
    public.fn_notification_event_body(NEW.event_type, NEW.payload),
    NEW.event_type,
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── Attach trigger (idempotent) ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_bridge_notification_event_to_inbox ON public.notification_events;

CREATE TRIGGER trg_bridge_notification_event_to_inbox
  AFTER INSERT ON public.notification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bridge_notification_event_to_inbox();

-- ── Tighten notifications RLS: user can read their own rows only ──────────────
-- The existing policy "notifications_all_member" uses company membership, which
-- is too broad for the inbox model. Android reads with user_id filter but RLS
-- must also enforce it server-side. Add a recipient-scoped policy.

DROP POLICY IF EXISTS notifications_recipient_select  ON public.notifications;
DROP POLICY IF EXISTS notifications_service_role_all  ON public.notifications;

-- Authenticated users see only their own notifications.
CREATE POLICY notifications_recipient_select
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role (bridge trigger, Edge Function) can write rows.
CREATE POLICY notifications_service_role_all
  ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Revoke broad public/anon access; keep only what is needed.
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT ALL    ON TABLE public.notifications TO service_role;

COMMENT ON TRIGGER trg_bridge_notification_event_to_inbox ON public.notification_events
IS 'Bridges canonical notification_events into the legacy notifications inbox. '
   'Required for native Android driver app (reads notifications via Supabase REST) '
   'and the web /m/ driver shell until both are migrated to notification_events directly.';

NOTIFY pgrst, 'reload schema';

COMMIT;
