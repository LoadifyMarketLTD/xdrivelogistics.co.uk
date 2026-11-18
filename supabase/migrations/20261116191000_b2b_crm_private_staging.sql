-- XDrive B2B CRM: private, service-only staging schema.
-- NOT APPLIED TO PRODUCTION. Do not add client grants or public policies.
CREATE TABLE IF NOT EXISTS public.crm_prospect_organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL CHECK (length(btrim(legal_name)) BETWEEN 2 AND 240),
  company_number text,
  website text,
  legal_form text NOT NULL DEFAULT 'unknown' CHECK (legal_form IN ('ltd','llp','sole_trader','other','unknown')),
  segment text NOT NULL CHECK (segment IN ('customer','broker','forwarder','carrier','mixed')),
  status text NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered','researching','qualified','contacted','replied','onboarding','converted','disqualified')),
  source_url text NOT NULL CHECK (length(btrim(source_url)) > 0),
  source_checked_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  converted_company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_prospect_company_number_unique
  ON public.crm_prospect_organisations (lower(btrim(company_number)))
  WHERE company_number IS NOT NULL AND length(btrim(company_number)) > 0;

CREATE TABLE IF NOT EXISTS public.crm_prospect_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.crm_prospect_organisations(id) ON DELETE RESTRICT,
  person_name text,
  job_title text,
  business_email text,
  business_phone text,
  contact_kind text NOT NULL DEFAULT 'unknown' CHECK (contact_kind IN ('generic_business','named_person','unknown')),
  lawful_basis text NOT NULL DEFAULT 'undetermined' CHECK (lawful_basis IN ('legitimate_interests','consent','other','undetermined')),
  lawful_basis_evidence text,
  source_url text NOT NULL CHECK (length(btrim(source_url)) > 0),
  collected_at timestamptz NOT NULL DEFAULT now(),
  first_notice_sent_at timestamptz,
  retention_review_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (business_email IS NOT NULL OR business_phone IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_prospect_org_email_unique
  ON public.crm_prospect_contacts (organisation_id, lower(btrim(business_email)))
  WHERE business_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.crm_prospect_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email','phone','all')),
  normalized_contact_value text NOT NULL CHECK (length(btrim(normalized_contact_value)) > 0),
  reason text NOT NULL CHECK (reason IN ('objection','opt_out','invalid','legal_hold','other')),
  source text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, normalized_contact_value)
);

CREATE TABLE IF NOT EXISTS public.crm_prospect_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.crm_prospect_organisations(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.crm_prospect_contacts(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id),
  channel text CHECK (channel IN ('email','phone','other')),
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note text,
  CHECK (length(event_type) BETWEEN 2 AND 80)
);

ALTER TABLE public.crm_prospect_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_prospect_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_prospect_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_prospect_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_prospect_organisations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_prospect_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_prospect_suppressions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_prospect_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_prospect_organisations FROM anon, authenticated;
REVOKE ALL ON public.crm_prospect_contacts FROM anon, authenticated;
REVOKE ALL ON public.crm_prospect_suppressions FROM anon, authenticated;
REVOKE ALL ON public.crm_prospect_events FROM anon, authenticated;
-- Deliberately no authenticated policies. Server service-role calls must
-- independently verify the Platform Owner JWT before accessing these tables.
