-- Production XDrive CRM: bounded, owner-only in-app alerts, no external messages.
-- Idempotency receipt rows are immutable for application roles.
CREATE TABLE IF NOT EXISTS public.crm_owner_alert_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_kind text NOT NULL CHECK (alert_kind IN ('follow_up_due','privacy_review','inbound_review','retention_review')),
  entity_id uuid NOT NULL,
  trigger_date date NOT NULL,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_kind,entity_id,trigger_date)
);

CREATE INDEX IF NOT EXISTS crm_owner_alert_receipts_recipient_idx
  ON public.crm_owner_alert_receipts (recipient_user_id, created_at DESC);

ALTER TABLE public.crm_owner_alert_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_owner_alert_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_owner_alert_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.crm_owner_alert_receipts TO service_role;

-- A daily scheduled job calls this SECURITY INVOKER function using only the
-- server-side service_role credential. Bounded, transactional, repeat-safe.
-- No direct customer contacts, personal data or emails are emitted.
CREATE OR REPLACE FUNCTION public.crm_emit_due_owner_alerts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  target record;
  receipt_id uuid;
  notice_id uuid;
  follow_up_count integer := 0;
  privacy_count integer := 0;
  inbound_count integer := 0;
  retention_count integer := 0;
  today_utc date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  FOR target IN
    SELECT id, owner_user_id, next_follow_up_at
      FROM public.crm_prospect_organisations
      WHERE owner_user_id IS NOT NULL
        AND next_follow_up_at IS NOT NULL
        AND next_follow_up_at <= now()
        AND status NOT IN ('converted','disqualified')
      ORDER BY next_follow_up_at ASC, id ASC
      LIMIT 100
  LOOP
    receipt_id := NULL;
    INSERT INTO public.crm_owner_alert_receipts
      (alert_kind,entity_id,trigger_date,recipient_user_id)
    VALUES ('follow_up_due',target.id,(target.next_follow_up_at AT TIME ZONE 'UTC')::date,target.owner_user_id)
    ON CONFLICT (alert_kind,entity_id,trigger_date) DO NOTHING
    RETURNING id INTO receipt_id;
    IF receipt_id IS NOT NULL THEN
      INSERT INTO public.notifications (company_id,user_id,title,body,type)
      VALUES (NULL,target.owner_user_id,'CRM follow-up due',
        'A commercial prospect needs a documented owner review in Super Admin. No customer was contacted.',
        'crm_follow_up')
      RETURNING id INTO notice_id;
      UPDATE public.crm_owner_alert_receipts SET notification_id=notice_id WHERE id=receipt_id;
      follow_up_count := follow_up_count + 1;
    END IF;
  END LOOP;

  FOR target IN
    SELECT r.id, COALESCE(r.last_actor_id,r.created_by) AS owner_id,
      ((r.created_at AT TIME ZONE 'UTC')::date + mark.days) AS milestone_date
    FROM public.crm_privacy_requests r
    CROSS JOIN LATERAL (
      SELECT max(days)::int AS days
      FROM (VALUES (1),(7),(21),(28)) milestones(days)
      WHERE days <= (today_utc - (r.created_at AT TIME ZONE 'UTC')::date)
    ) mark
    WHERE r.status IN ('received','reviewing','approved')
      AND COALESCE(r.last_actor_id,r.created_by) IS NOT NULL
      AND mark.days IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_owner_alert_receipts receipt
        WHERE receipt.alert_kind='privacy_review'
          AND receipt.entity_id=r.id AND receipt.trigger_date=
            ((r.created_at AT TIME ZONE 'UTC')::date + mark.days)
      )
    ORDER BY r.created_at ASC,r.id
    LIMIT 100
  LOOP
    receipt_id := NULL;
    INSERT INTO public.crm_owner_alert_receipts
      (alert_kind,entity_id,trigger_date,recipient_user_id)
    VALUES ('privacy_review',target.id,target.milestone_date,target.owner_id)
    ON CONFLICT (alert_kind,entity_id,trigger_date) DO NOTHING
    RETURNING id INTO receipt_id;
    IF receipt_id IS NOT NULL THEN
      INSERT INTO public.notifications (company_id,user_id,title,body,type)
      VALUES (NULL,target.owner_id,'CRM data-rights review',
        'A CRM privacy request requires an owner review. Verify the applicable statutory deadline; no personal details are included.',
        'crm_privacy')
      RETURNING id INTO notice_id;
      UPDATE public.crm_owner_alert_receipts SET notification_id=notice_id WHERE id=receipt_id;
      privacy_count := privacy_count + 1;
    END IF;
  END LOOP;

  -- A business-interest submission remains a non-customer until owner triage.
  -- One reminder after 24 hours; the Super Admin queue remains continuously visible.
  FOR target IN
    SELECT i.id,p.user_id AS owner_id
    FROM public.crm_business_interests i
    CROSS JOIN LATERAL (
      SELECT user_id FROM public.profiles
      WHERE lower(role::text)='owner' AND lower(status::text)='active'
      ORDER BY user_id LIMIT 1
    ) p
    WHERE i.status='new' AND i.created_at < now()-interval '1 day'
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_owner_alert_receipts r
        WHERE r.alert_kind='inbound_review' AND r.entity_id=i.id
      )
    ORDER BY i.created_at ASC,i.id
    LIMIT 100
  LOOP
    receipt_id:=NULL;
    INSERT INTO public.crm_owner_alert_receipts
      (alert_kind,entity_id,trigger_date,recipient_user_id)
    VALUES ('inbound_review',target.id,today_utc,target.owner_id)
    ON CONFLICT (alert_kind,entity_id,trigger_date) DO NOTHING
    RETURNING id INTO receipt_id;
    IF receipt_id IS NOT NULL THEN
      INSERT INTO public.notifications(company_id,user_id,title,body,type)
      VALUES(NULL,target.owner_id,'New business enquiry awaiting review',
        'A new commercial enquiry has been received. Check the Super Admin CRM inbox; it is not a verified member or marketing opt-in.',
        'crm_business_interest')
      RETURNING id INTO notice_id;
      UPDATE public.crm_owner_alert_receipts SET notification_id=notice_id WHERE id=receipt_id;
      inbound_count:=inbound_count+1;
    END IF;
  END LOOP;

  -- Retention decisions require human review: never erase customer or legal
  -- records automatically, and do not send personal details in notifications.
  FOR target IN
    SELECT i.id,p.user_id AS owner_id
    FROM public.crm_business_interests i
    CROSS JOIN LATERAL (
      SELECT user_id FROM public.profiles
      WHERE lower(role::text)='owner' AND lower(status::text)='active'
      ORDER BY user_id LIMIT 1
    ) p
    WHERE i.retained_until <= now()
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_owner_alert_receipts r
        WHERE r.alert_kind='retention_review' AND r.entity_id=i.id
      )
    ORDER BY i.retained_until ASC,i.id
    LIMIT 100
  LOOP
    receipt_id:=NULL;
    INSERT INTO public.crm_owner_alert_receipts
      (alert_kind,entity_id,trigger_date,recipient_user_id)
    VALUES ('retention_review',target.id,today_utc,target.owner_id)
    ON CONFLICT (alert_kind,entity_id,trigger_date) DO NOTHING
    RETURNING id INTO receipt_id;
    IF receipt_id IS NOT NULL THEN
      INSERT INTO public.notifications(company_id,user_id,title,body,type)
      VALUES(NULL,target.owner_id,'Business enquiry retention review due',
        'A CRM business-interest retention period has expired. Review applicable rights and legal holds before any deletion.',
        'crm_retention_review')
      RETURNING id INTO notice_id;
      UPDATE public.crm_owner_alert_receipts SET notification_id=notice_id WHERE id=receipt_id;
      retention_count:=retention_count+1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inbound_notified',inbound_count,
    'retention_notified',retention_count,
    'followups_notified',follow_up_count,
    'privacy_notified',privacy_count,
    'outbound_marketing_sent',0,
    'triggered_at',now()
  );
END $$;

REVOKE ALL ON FUNCTION public.crm_emit_due_owner_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_emit_due_owner_alerts() TO service_role;
