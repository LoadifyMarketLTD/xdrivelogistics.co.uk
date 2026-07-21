-- Canonical carrier-company assignment for marketplace jobs.
-- Driver APIs, allocation RPCs and native clients already consume this field,
-- but historical clean installs did not materialize it.

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS assigned_company_id uuid
    REFERENCES public.companies(id) ON DELETE SET NULL;

UPDATE public.jobs
SET assigned_company_id = awarded_carrier_company_id
WHERE assigned_company_id IS NULL
  AND awarded_carrier_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_company_status
  ON public.jobs (assigned_company_id, status)
  WHERE assigned_company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_jobs_sync_assigned_company()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_company_id IS NULL
     AND NEW.awarded_carrier_company_id IS NOT NULL
     AND NEW.status::text IN (
       'awarded', 'allocated', 'on_my_way', 'on_site_pickup', 'loaded',
       'collected', 'in_transit', 'on_site_delivery', 'delivered',
       'completed', 'invoiced', 'paid'
     )
  THEN
    NEW.assigned_company_id := NEW.awarded_carrier_company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_sync_assigned_company ON public.jobs;
CREATE TRIGGER trg_jobs_sync_assigned_company
BEFORE INSERT OR UPDATE OF awarded_carrier_company_id, assigned_company_id, assigned_driver_id, status
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_jobs_sync_assigned_company();

COMMENT ON COLUMN public.jobs.assigned_company_id IS
  'Carrier company responsible for the allocated job; distinct from the buyer company in jobs.company_id.';

NOTIFY pgrst, 'reload schema';

COMMIT;
