-- XDrive CRM workflow extension for isolated staging. DO NOT APPLY TO PRODUCTION.
-- Generated as a source migration after Supabase CLI failed to spawn on Windows.
-- Review via clean local replay and RLS/security advisors before any deployment.

ALTER TABLE public.crm_prospect_organisations
  ADD COLUMN IF NOT EXISTS website_domain text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'company_website',
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_actor_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_change_note text;

ALTER TABLE public.crm_prospect_organisations
  ADD CONSTRAINT crm_org_source_type_check CHECK (source_type IN
    ('companies_house','company_website','existing_customer','partner_referral','inbound_enquiry','owner_csv')),
  ADD CONSTRAINT crm_org_priority_check CHECK (priority IN ('low','normal','high'));

ALTER TABLE public.crm_prospect_organisations
  ADD CONSTRAINT crm_prospect_converted_company_fk
  FOREIGN KEY (converted_company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS crm_converted_company_unique
  ON public.crm_prospect_organisations(converted_company_id)
  WHERE converted_company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_org_website_domain_unique
  ON public.crm_prospect_organisations (lower(btrim(website_domain)))
  WHERE website_domain IS NOT NULL AND length(btrim(website_domain)) > 0;

CREATE INDEX IF NOT EXISTS crm_org_followup_due_idx
  ON public.crm_prospect_organisations(next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_org_owner_idx
  ON public.crm_prospect_organisations(owner_user_id);

ALTER TABLE public.crm_prospect_contacts
  ADD COLUMN IF NOT EXISTS contact_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS corporate_subscriber_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lia_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tps_ctps_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS tps_ctps_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_actor_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_review_note text,
  ADD CONSTRAINT crm_contact_status_check CHECK (contact_status IN ('active','review_due','archived'));

CREATE UNIQUE INDEX IF NOT EXISTS crm_prospect_org_phone_unique
  ON public.crm_prospect_contacts (organisation_id,
    regexp_replace(business_phone,'[[:space:]().-]','','g'))
  WHERE business_phone IS NOT NULL AND length(btrim(business_phone)) > 0;

ALTER TABLE public.crm_prospect_events
  DROP CONSTRAINT IF EXISTS crm_prospect_events_contact_id_fkey;
ALTER TABLE public.crm_prospect_events
  ADD CONSTRAINT crm_prospect_events_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.crm_prospect_contacts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.crm_campaign_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  segment text NOT NULL CHECK (segment IN ('customer','broker','forwarder','carrier','mixed')),
  channel text NOT NULL CHECK (channel IN ('email','phone')),
  subject text,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 6000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  approval_evidence text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  last_actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_campaign_approval_consistency CHECK
    (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL
      AND length(btrim(coalesce(approval_evidence,''))) >= 30))
);

CREATE TABLE IF NOT EXISTS public.crm_campaign_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.crm_campaign_drafts(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.crm_prospect_contacts(id) ON DELETE SET NULL,
  organisation_id uuid NOT NULL REFERENCES public.crm_prospect_organisations(id) ON DELETE RESTRICT,
  request_type text NOT NULL CHECK (request_type IN ('access','erasure','objection')),
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','reviewing','approved','rejected','fulfilled')),
  request_note text NOT NULL,
  review_note text,
  requester_verified boolean NOT NULL DEFAULT false,
  legal_hold boolean NOT NULL DEFAULT false,
  legal_hold_reviewed_at timestamptz,
  legal_hold_reviewed_by uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  last_actor_id uuid REFERENCES auth.users(id),
  completed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS crm_privacy_status_idx
  ON public.crm_privacy_requests(status, created_at);

CREATE TABLE IF NOT EXISTS public.crm_privacy_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.crm_privacy_requests(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id),
  status text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.crm_audit_prospect_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crm_prospect_events(organisation_id,actor_user_id,channel,event_type,note)
      VALUES(NEW.id,NEW.created_by,'other','organisation_created','Verified source recorded');
  ELSIF NEW IS DISTINCT FROM OLD THEN
    INSERT INTO public.crm_prospect_events(organisation_id,actor_user_id,channel,event_type,note)
      VALUES(NEW.id,NEW.last_actor_id,'other',
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_changed' ELSE 'organisation_updated' END,
        left(coalesce(NEW.last_change_note,
          CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN OLD.status || ' -> ' || NEW.status
            ELSE 'Owner / follow-up / evidence updated' END), 2000));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crm_audit_organisation ON public.crm_prospect_organisations;
CREATE TRIGGER crm_audit_organisation
AFTER INSERT OR UPDATE ON public.crm_prospect_organisations
FOR EACH ROW EXECUTE FUNCTION public.crm_audit_prospect_change();

CREATE OR REPLACE FUNCTION public.crm_audit_contact_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.crm_prospect_events(organisation_id,contact_id,actor_user_id,channel,event_type,note)
  VALUES(NEW.organisation_id,NEW.id,NEW.last_actor_id,'other',
    CASE WHEN TG_OP='INSERT' THEN 'contact_created' ELSE 'contact_updated' END,
    left(coalesce(NEW.last_review_note,'Contact provenance / retention updated'),2000));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crm_contact_audit_trigger ON public.crm_prospect_contacts;
CREATE TRIGGER crm_contact_audit_trigger
AFTER INSERT OR UPDATE ON public.crm_prospect_contacts
FOR EACH ROW EXECUTE FUNCTION public.crm_audit_contact_change();

CREATE OR REPLACE FUNCTION public.crm_audit_campaign_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.crm_campaign_audit(campaign_id,actor_id,action)
  VALUES (NEW.id,coalesce(NEW.last_actor_id,NEW.created_by),
    CASE WHEN TG_OP='INSERT' THEN 'draft_created'
      WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_' || NEW.status
      ELSE 'draft_edited' END);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crm_campaign_audit_trigger ON public.crm_campaign_drafts;
CREATE TRIGGER crm_campaign_audit_trigger
AFTER INSERT OR UPDATE ON public.crm_campaign_drafts
FOR EACH ROW EXECUTE FUNCTION public.crm_audit_campaign_change();

CREATE OR REPLACE FUNCTION public.crm_audit_privacy_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.crm_privacy_audit(request_id,actor_id,status)
    VALUES(NEW.id,coalesce(NEW.last_actor_id,NEW.created_by),NEW.status);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crm_privacy_audit_trigger ON public.crm_privacy_requests;
CREATE TRIGGER crm_privacy_audit_trigger
AFTER INSERT OR UPDATE ON public.crm_privacy_requests
FOR EACH ROW EXECUTE FUNCTION public.crm_audit_privacy_change();

-- Preserve immutable activity records, except the mandatory FK nullification
-- for an approved personal-data erasure in the same database transaction.
CREATE OR REPLACE FUNCTION public.crm_protect_audit_row()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  -- PL/pgSQL evaluates record-field expressions even within a boolean AND.
  -- Only the prospect event table has contact_id; branch before accessing it.
  IF TG_TABLE_NAME = 'crm_prospect_events' THEN
    IF TG_OP = 'UPDATE' THEN
      IF current_setting('xdrive.crm_erasure', true) = 'yes'
        AND OLD.contact_id IS NOT NULL AND NEW.contact_id IS NULL
        AND NEW.note = '[redacted after verified contact erasure]'
        AND (to_jsonb(NEW) - 'contact_id' - 'note') = (to_jsonb(OLD) - 'contact_id' - 'note')
      THEN RETURN NEW;
      END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'CRM audit entries are append-only' USING ERRCODE='23514';
END;
$$;
DROP TRIGGER IF EXISTS crm_prospect_event_immutable ON public.crm_prospect_events;
CREATE TRIGGER crm_prospect_event_immutable BEFORE UPDATE OR DELETE
  ON public.crm_prospect_events FOR EACH ROW EXECUTE FUNCTION public.crm_protect_audit_row();
DROP TRIGGER IF EXISTS crm_campaign_audit_immutable ON public.crm_campaign_audit;
CREATE TRIGGER crm_campaign_audit_immutable BEFORE UPDATE OR DELETE
  ON public.crm_campaign_audit FOR EACH ROW EXECUTE FUNCTION public.crm_protect_audit_row();
DROP TRIGGER IF EXISTS crm_privacy_audit_immutable ON public.crm_privacy_audit;
CREATE TRIGGER crm_privacy_audit_immutable BEFORE UPDATE OR DELETE
  ON public.crm_privacy_audit FOR EACH ROW EXECUTE FUNCTION public.crm_protect_audit_row();

CREATE OR REPLACE FUNCTION public.crm_execute_prospect_erasure(
  p_request_id uuid, p_actor_id uuid, p_evidence text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE r public.crm_privacy_requests%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR length(btrim(coalesce(p_evidence,''))) < 30
     OR length(p_evidence) > 2000 THEN
    RAISE EXCEPTION 'Erasure evidence missing';
  END IF;
  SELECT * INTO r FROM public.crm_privacy_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR r.request_type <> 'erasure' OR r.status <> 'approved'
     OR NOT r.requester_verified OR r.legal_hold OR r.legal_hold_reviewed_at IS NULL
     OR r.contact_id IS NULL THEN
    RAISE EXCEPTION 'Erasure not eligible or identity not verified';
  END IF;
  PERFORM set_config('xdrive.crm_erasure', 'yes', true);
  -- Preserve activity metadata but delete direct contact references and free-text
  -- notes attached to this contact. The narrowly-scoped audit trigger exception
  -- only permits exactly this redaction within the approved erasure transaction.
  UPDATE public.crm_prospect_events
    SET contact_id = NULL, note = '[redacted after verified contact erasure]'
    WHERE contact_id = r.contact_id;
  DELETE FROM public.crm_prospect_contacts WHERE id=r.contact_id AND organisation_id=r.organisation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contact not found for erasure'; END IF;
  UPDATE public.crm_privacy_requests
  SET status='fulfilled', review_note=left(coalesce(review_note,'') || ' | ' || p_evidence,2000),
      contact_id=NULL, completed_by=p_actor_id, completed_at=now(), updated_at=now(), last_actor_id=p_actor_id
  WHERE id=p_request_id;
  PERFORM set_config('xdrive.crm_erasure', 'no', true);
  RETURN jsonb_build_object('request_id',p_request_id,'status','fulfilled','personal_record_deleted',true);
END;
$$;

-- Fail closed: tables are server-only. Never grant anon/authenticated data access.
DO $$
DECLARE obj text;
BEGIN
  FOREACH obj IN ARRAY ARRAY['crm_campaign_drafts','crm_campaign_audit',
                              'crm_privacy_requests','crm_privacy_audit'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', obj);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', obj);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', obj);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.crm_execute_prospect_erasure(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_execute_prospect_erasure(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.crm_audit_prospect_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_audit_campaign_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_audit_contact_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_audit_privacy_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_protect_audit_row() FROM PUBLIC;
