BEGIN;

-- The current Owner Job API and atomic delete/edit guards query both of these
-- server-side dependency tables. Hosted production carries them with RLS enabled
-- and no raw anon/authenticated table privileges, while the clean chain omitted
-- them entirely. Reconstruct only the observed production contracts before the
-- guards are defined so a fresh deploy cannot fail at runtime.
CREATE TABLE IF NOT EXISTS public.proof_of_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  delivered_on date NOT NULL DEFAULT CURRENT_DATE,
  received_by text NOT NULL,
  left_at text,
  no_of_items integer,
  delivery_status text NOT NULL DEFAULT 'Completed Delivery'
    CHECK (delivery_status IN ('Completed Delivery', 'Partial Delivery', 'Failed Delivery', 'Refused', 'Left Safe')),
  delivery_notes text,
  signature_url text,
  photo_urls text[],
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pod_job_id
  ON public.proof_of_delivery (job_id);
CREATE INDEX IF NOT EXISTS idx_pod_created_by
  ON public.proof_of_delivery (created_by);

ALTER TABLE public.proof_of_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.proof_of_delivery FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.proof_of_delivery TO service_role;

CREATE TABLE IF NOT EXISTS public.job_cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  owner_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  carrier_company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  requested_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  requester_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  requester_party text NOT NULL CHECK (requester_party IN ('load_owner', 'carrier')),
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 5 AND char_length(trim(reason)) <= 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_cancellation_requests_job_created_idx
  ON public.job_cancellation_requests (job_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS job_cancellation_requests_one_pending_idx
  ON public.job_cancellation_requests (job_id)
  WHERE status = 'pending';

ALTER TABLE public.job_cancellation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_cancellation_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.job_cancellation_requests TO service_role;

-- Hosted proof_of_delivery maintains updated_at with this generic trigger
-- function. Reconstruct the exact function body needed by the table, but keep
-- direct client execution closed.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

DROP TRIGGER IF EXISTS pod_updated_at ON public.proof_of_delivery;
CREATE TRIGGER pod_updated_at
BEFORE UPDATE ON public.proof_of_delivery
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF to_regclass('public.proof_of_delivery') IS NULL
     OR to_regclass('public.job_cancellation_requests') IS NULL THEN
    RAISE EXCEPTION 'Owner Job runtime dependency tables were not reconstructed.';
  END IF;

  IF has_table_privilege('anon', 'public.proof_of_delivery', 'SELECT')
     OR has_table_privilege('authenticated', 'public.proof_of_delivery', 'SELECT')
     OR has_table_privilege('anon', 'public.job_cancellation_requests', 'SELECT')
     OR has_table_privilege('authenticated', 'public.job_cancellation_requests', 'SELECT') THEN
    RAISE EXCEPTION 'Owner Job dependency tables unexpectedly expose raw client reads.';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.proof_of_delivery', 'SELECT,INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('service_role', 'public.job_cancellation_requests', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Owner Job dependency tables are not available to service_role.';
  END IF;
END;
$$;

-- Repair the one safe legacy drift class where an unallocated cancellation was
-- written to jobs.status before current_status synchronization existed. Do not
-- overwrite progressed/allocated execution state.
UPDATE public.jobs
SET current_status = 'cancelled',
    updated_at = now()
WHERE lower(btrim(coalesce(status, ''))) = 'cancelled'
  AND lower(btrim(coalesce(current_status, ''))) IN ('draft', 'open', 'received', 'posted', 'quoted')
  AND awarded_carrier_company_id IS NULL
  AND assigned_company_id IS NULL
  AND assigned_driver_id IS NULL
  AND vehicle_id IS NULL;

-- The historical function referenced a removed loads.job_id column and an older
-- owner_audit_log shape. Replace it with the current jobs-only contract and keep
-- the delete fully atomic so a concurrent bid cannot be cascaded away between a
-- preflight check and DELETE.
CREATE OR REPLACE FUNCTION public.delete_unbid_exchange_job_atomic(
  p_job_id uuid,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_status text;
  v_current_status text;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated actor is required.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.user_id = p_actor_user_id
      AND cm.company_id = v_job.company_id
      AND cm.status = 'active'
      AND cm.role_in_company::text IN ('owner', 'admin', 'dispatcher')
  ) THEN
    RAISE EXCEPTION
      'Only an authorised member of the load-owning company can delete this load.'
      USING ERRCODE = '42501';
  END IF;

  v_status := lower(btrim(coalesce(v_job.status, '')));
  v_current_status := lower(btrim(coalesce(v_job.current_status, '')));

  IF v_status NOT IN ('draft', 'received', 'posted')
     OR v_current_status NOT IN ('draft', 'received', 'posted') THEN
    RAISE EXCEPTION
      'Only pre-award loads can be deleted.'
      USING ERRCODE = '23514';
  END IF;

  IF v_job.awarded_carrier_company_id IS NOT NULL
     OR v_job.assigned_company_id IS NOT NULL
     OR v_job.assigned_driver_id IS NOT NULL
     OR v_job.vehicle_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Active, awarded or assigned loads cannot be deleted.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.job_bids WHERE job_id = p_job_id) THEN
    RAISE EXCEPTION
      'Loads with bid history cannot be deleted; cancel the load instead.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.job_commercial_agreements WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.proof_of_delivery WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.invoices WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.job_disputes WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.job_cancellation_requests WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.invoice_disputes WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.quotes WHERE converted_job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.reviews WHERE job_id = p_job_id) THEN
    RAISE EXCEPTION
      'This load already has protected commercial or execution history.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.job_documents WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.documents WHERE job_id = p_job_id) THEN
    RAISE EXCEPTION
      'This load has stored documents and cannot be deleted.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.job_stops s
    WHERE s.job_id = p_job_id
      AND (
        lower(coalesce(s.status, 'pending')) <> 'pending'
        OR s.arrived_at IS NOT NULL
        OR s.completed_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION
      'This load already has progressed stop history.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.owner_audit_log(
    target_type,
    target_id,
    target_name,
    metadata,
    actor_user_id,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason
  )
  VALUES (
    'job',
    v_job.id,
    'XDL-' || upper(left(v_job.id::text, 8)),
    jsonb_build_object(
      'source', 'workspace_owner_delete',
      'current_status', v_current_status
    ),
    p_actor_user_id,
    v_job.company_id,
    'exchange_load_deleted_without_bids',
    v_status,
    'deleted',
    'Load deleted before bids, award or execution history.'
  );

  DELETE FROM public.jobs
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'jobId', p_job_id,
    'status', 'deleted'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_unbid_exchange_job_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_unbid_exchange_job_atomic(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_unbid_exchange_job_atomic(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_unbid_exchange_job_atomic(uuid, uuid) TO service_role;

COMMIT;
