-- XDrive Production CRM: separate public business interest review from canonical
-- transport quotes, member accounts and marketing consent.
CREATE TABLE IF NOT EXISTS public.crm_business_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL CHECK(length(btrim(business_name)) BETWEEN 2 AND 240),
  business_email text NOT NULL CHECK(length(btrim(business_email)) BETWEEN 5 AND 254),
  contact_name text NOT NULL CHECK(length(btrim(contact_name)) BETWEEN 2 AND 120),
  company_number text CHECK(company_number IS NULL OR length(company_number) <= 32),
  interest_kind text NOT NULL CHECK(interest_kind IN ('membership','partnership','commercial','other')),
  message text NOT NULL CHECK(length(btrim(message)) BETWEEN 15 AND 2000),
  source text NOT NULL CHECK(source IN ('contact_form','owner_email_review')),
  source_reference text CHECK(source_reference IS NULL OR length(source_reference) <= 500),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  privacy_notice_accepted_at timestamptz,
  CONSTRAINT crm_business_contact_privacy_ack CHECK(source <> 'contact_form' OR privacy_notice_accepted_at IS NOT NULL),
  status text NOT NULL DEFAULT 'new'
    CHECK(status IN ('new','reviewing','accepted','declined')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  retained_until timestamptz NOT NULL DEFAULT (now()+interval '180 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_business_interests_status_idx
  ON public.crm_business_interests(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_business_interest_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN ('review','accept','decline')),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  note text NOT NULL CHECK(length(btrim(note)) BETWEEN 20 AND 2000),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.crm_protect_business_interest_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'CRM business interest review audit is immutable';
END $$;
DROP TRIGGER IF EXISTS crm_business_interest_audit_immutable ON public.crm_business_interest_audit;
CREATE TRIGGER crm_business_interest_audit_immutable
  BEFORE UPDATE OR DELETE ON public.crm_business_interest_audit
  FOR EACH ROW EXECUTE FUNCTION public.crm_protect_business_interest_audit();

CREATE OR REPLACE FUNCTION public.crm_triage_business_interest(
  p_interest_id uuid, p_actor_id uuid, p_action text, p_note text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp
AS $$
DECLARE r record; next_status text;
BEGIN
  IF p_interest_id IS NULL OR p_actor_id IS NULL OR
     p_action NOT IN ('review','accept','decline') OR
     length(btrim(coalesce(p_note,''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Valid owner review decision and evidence required'
      USING ERRCODE='22023';
  END IF;
  SELECT id,status INTO r
    FROM public.crm_business_interests WHERE id=p_interest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business interest not found' USING ERRCODE='P0002'; END IF;
  IF r.status NOT IN ('new','reviewing') THEN
    RAISE EXCEPTION 'Finalized interests cannot be reclassified silently'
      USING ERRCODE='23514';
  END IF;
  next_status := CASE p_action WHEN 'review' THEN 'reviewing'
    WHEN 'accept' THEN 'accepted' ELSE 'declined' END;
  UPDATE public.crm_business_interests SET status=next_status, reviewed_by=p_actor_id,
    reviewed_at=now(), review_note=btrim(p_note), updated_at=now()
    WHERE id=p_interest_id;
  INSERT INTO public.crm_business_interest_audit(interest_id,action,actor_user_id,note)
    VALUES(p_interest_id,p_action,p_actor_id,btrim(p_note));
  RETURN jsonb_build_object('id',p_interest_id,'status',next_status,'actor',p_actor_id);
END $$;

-- Allow a verified business interest to become an owner-reviewed CRM source,
-- but never automatically accept it as an organisation or marketing opt-in.
ALTER TABLE public.crm_prospect_organisations DROP CONSTRAINT IF EXISTS crm_org_source_type_check;
ALTER TABLE public.crm_prospect_organisations
  ADD CONSTRAINT crm_org_source_type_check
  CHECK(source_type IN ('companies_house','company_website','existing_customer',
    'partner_referral','inbound_enquiry','owner_csv','business_interest'));

ALTER TABLE public.crm_business_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_business_interests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_business_interest_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_business_interest_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_business_interests, public.crm_business_interest_audit
  FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.crm_business_interests TO service_role;
GRANT SELECT,INSERT ON TABLE public.crm_business_interest_audit TO service_role;
REVOKE ALL ON FUNCTION public.crm_triage_business_interest(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_triage_business_interest(uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.crm_protect_business_interest_audit()
  FROM PUBLIC, anon, authenticated;
