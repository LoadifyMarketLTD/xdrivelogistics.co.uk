-- XDrive CRM evidence-only first real job attestation.
-- All jobs present in the verified 2026-11-17 15:25 UTC test baseline are
-- excluded WITHOUT altering canonical jobs; fixed UTC cutoff makes migration
-- safe to replay without accidentally excluding future genuine jobs.
CREATE TABLE IF NOT EXISTS public.crm_job_test_baseline_exclusions (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE RESTRICT,
  reason text NOT NULL DEFAULT 'User confirmed all existing platform jobs were fictive for tests on 2026-11-17',
  recorded_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.crm_job_test_baseline_exclusions(job_id)
  -- Every job already present when the safe feature migration is installed
  -- belongs to the historical all-test baseline, regardless of is_test flag.
  SELECT id FROM public.jobs
  WHERE created_at IS NULL OR created_at <= '2026-11-17T15:25:00Z'::timestamptz
  ON CONFLICT(job_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.crm_verified_first_real_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL UNIQUE
    REFERENCES public.crm_prospect_organisations(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE RESTRICT,
  verified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 60 AND 2000),
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_real_job_verified_at
  ON public.crm_verified_first_real_jobs(verified_at DESC);

-- Exactly one first-job proof per prospect; never infer financial revenue.
CREATE OR REPLACE FUNCTION public.crm_attest_first_real_job(
  p_organisation_id uuid,
  p_job_id uuid,
  p_actor_id uuid,
  p_evidence text,
  p_confirmation text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp
AS $$
DECLARE
  prospect record;
  company record;
  job record;
  created uuid;
BEGIN
  IF p_confirmation <> 'I_VERIFIED_THIS_IS_A_REAL_PAID_OR_CONTRACTED_JOB_NOT_TEST'
     OR p_actor_id IS NULL
     OR length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 60 AND 2000 THEN
    RAISE EXCEPTION 'Explicit real-world review attestation and documentary evidence required'
      USING ERRCODE='22023';
  END IF;

  SELECT id,status,converted_company_id INTO prospect
    FROM public.crm_prospect_organisations WHERE id=p_organisation_id FOR UPDATE;
  IF NOT FOUND OR prospect.status<>'converted' OR prospect.converted_company_id IS NULL THEN
    RAISE EXCEPTION 'Verified converted member prospect required' USING ERRCODE='23514';
  END IF;
  SELECT id,status INTO company FROM public.companies
    WHERE id=prospect.converted_company_id;
  IF NOT FOUND OR company.status<>'active' THEN
    RAISE EXCEPTION 'Member company must be active' USING ERRCODE='23514';
  END IF;
  SELECT id,posted_by_company_id,assigned_company_id,is_test,created_at,
    status,current_status,completed_at,has_delivery_evidence
    INTO job FROM public.jobs WHERE id=p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='P0002'; END IF;
  IF job.is_test IS DISTINCT FROM false OR
     job.created_at IS NULL OR
     job.created_at <= '2026-11-17T15:25:00Z'::timestamptz OR
     EXISTS (SELECT 1 FROM public.crm_job_test_baseline_exclusions e WHERE e.job_id=job.id) THEN
    RAISE EXCEPTION 'Historical or flagged test jobs can never be counted as real CRM conversion'
      USING ERRCODE='23514';
  END IF;
  IF NOT (job.posted_by_company_id=prospect.converted_company_id OR
          job.assigned_company_id=prospect.converted_company_id) OR
     job.completed_at IS NULL OR job.has_delivery_evidence IS DISTINCT FROM true OR
     (lower(coalesce(job.current_status,'')) NOT IN ('completed','delivered')
        AND lower(coalesce(job.status,'')) NOT IN ('completed','delivered')) THEN
    RAISE EXCEPTION 'Completed, documented job with member-company relationship required'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.crm_verified_first_real_jobs
    (organisation_id,company_id,job_id,verified_by,evidence)
  VALUES (prospect.id,prospect.converted_company_id,job.id,p_actor_id,btrim(p_evidence))
  RETURNING id INTO created;
  RETURN jsonb_build_object('attestation_id',created,
    'organisation_id',prospect.id,'verified_job_id',job.id,
    'revenue_gbp',null,'financial_receipt_verified',false);
END $$;

CREATE OR REPLACE FUNCTION public.crm_forbid_real_job_proof_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'A real-job attestation is immutable and must be reconciled separately';
END $$;
DROP TRIGGER IF EXISTS crm_real_job_proof_immutable ON public.crm_verified_first_real_jobs;
CREATE TRIGGER crm_real_job_proof_immutable BEFORE UPDATE OR DELETE
  ON public.crm_verified_first_real_jobs
  FOR EACH ROW EXECUTE FUNCTION public.crm_forbid_real_job_proof_change();

ALTER TABLE public.crm_job_test_baseline_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_job_test_baseline_exclusions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_verified_first_real_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_verified_first_real_jobs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_job_test_baseline_exclusions, public.crm_verified_first_real_jobs
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.crm_job_test_baseline_exclusions TO service_role;
GRANT SELECT,INSERT ON public.crm_verified_first_real_jobs TO service_role;
REVOKE ALL ON FUNCTION public.crm_attest_first_real_job(uuid,uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_attest_first_real_job(uuid,uuid,uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.crm_forbid_real_job_proof_change()
  FROM PUBLIC,anon,authenticated;
