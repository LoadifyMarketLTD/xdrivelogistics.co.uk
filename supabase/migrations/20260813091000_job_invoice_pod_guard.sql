-- Job-linked invoice DB guard.
-- Prevent legacy or future application routes from bypassing the canonical
-- Delivered + valid POD -> Invoice Draft invariant.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_require_canonical_pod_for_job_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_effective_status text;
  v_executing_company_id uuid;
  v_pod_completed_at timestamptz;
BEGIN
  IF NEW.job_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_job
  FROM public.jobs j
  WHERE j.id = NEW.job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice job does not exist.' USING ERRCODE = '23503';
  END IF;

  v_effective_status := lower(coalesce(nullif(v_job.current_status, ''), nullif(v_job.status::text, ''), ''));
  IF v_effective_status NOT IN ('delivered', 'completed') THEN
    RAISE EXCEPTION 'Invoice Draft requires a Delivered job.' USING ERRCODE = '23514';
  END IF;

  IF NOT public.is_job_pod_valid(NEW.job_id) THEN
    RAISE EXCEPTION 'Invoice Draft requires a valid stored POD.' USING ERRCODE = '23514';
  END IF;

  IF nullif(btrim(coalesce(v_job.customer_ref, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Invoice Draft requires the canonical XDrive Job Ref.' USING ERRCODE = '23514';
  END IF;

  -- A job-linked transport invoice belongs to the executing supplier entity.
  v_executing_company_id := coalesce(
    v_job.awarded_carrier_company_id,
    v_job.assigned_company_id,
    v_job.company_id
  );

  IF v_executing_company_id IS NOT NULL
     AND NEW.company_id IS DISTINCT FROM v_executing_company_id
  THEN
    RAISE EXCEPTION 'Invoice issuer must be the executing supplier company.' USING ERRCODE = '23514';
  END IF;

  SELECT p.completed_at
  INTO v_pod_completed_at
  FROM public.proof_of_delivery p
  WHERE p.job_id = NEW.job_id
  LIMIT 1;

  -- Canonical values are server-enforced, never accepted from external refs.
  NEW.job_ref := v_job.customer_ref;
  NEW.pod_required := true;
  NEW.pod_generated := true;
  NEW.pod_generated_at := coalesce(v_pod_completed_at, NEW.pod_generated_at, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_canonical_pod_for_job_invoice ON public.invoices;
CREATE TRIGGER trg_require_canonical_pod_for_job_invoice
BEFORE INSERT OR UPDATE OF job_id, job_ref, company_id, status
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_require_canonical_pod_for_job_invoice();

COMMENT ON FUNCTION public.fn_require_canonical_pod_for_job_invoice() IS
  'DB boundary: job invoices require Delivered/Completed + canonical POD and always use jobs.customer_ref.';

NOTIFY pgrst, 'reload schema';

COMMIT;
