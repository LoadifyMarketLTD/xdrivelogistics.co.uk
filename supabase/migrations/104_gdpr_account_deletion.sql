-- Migration 104: GDPR account deletion function
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_gdpr_delete_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_ids uuid[] := ARRAY[]::uuid[];
  v_driver_ids uuid[] := ARRAY[]::uuid[];
  v_vehicle_ids uuid[] := ARRAY[]::uuid[];
  v_job_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT company_id), ARRAY[]::uuid[])
  INTO v_company_ids
  FROM (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = p_user_id AND p.company_id IS NOT NULL
    UNION
    SELECT cm.company_id FROM public.company_memberships cm WHERE cm.user_id = p_user_id AND cm.company_id IS NOT NULL
    UNION
    SELECT d.company_id FROM public.drivers d WHERE d.user_id = p_user_id AND d.company_id IS NOT NULL
    UNION
    SELECT c.id FROM public.companies c WHERE c.created_by = p_user_id
  ) company_scope;

  SELECT COALESCE(array_agg(DISTINCT d.id), ARRAY[]::uuid[])
  INTO v_driver_ids
  FROM public.drivers d
  WHERE d.user_id = p_user_id
     OR d.company_id = ANY(v_company_ids);

  SELECT COALESCE(array_agg(DISTINCT v.id), ARRAY[]::uuid[])
  INTO v_vehicle_ids
  FROM public.vehicles v
  WHERE v.company_id = ANY(v_company_ids);

  SELECT COALESCE(array_agg(DISTINCT j.id), ARRAY[]::uuid[])
  INTO v_job_ids
  FROM public.jobs j
  WHERE j.created_by = p_user_id
     OR j.company_id = ANY(v_company_ids)
     OR j.awarded_carrier_company_id = ANY(v_company_ids);

  DELETE FROM public.driver_locations
  WHERE driver_id = ANY(v_driver_ids)
     OR company_id = ANY(v_company_ids);

  DELETE FROM public.driver_documents
  WHERE driver_id = ANY(v_driver_ids);

  DELETE FROM public.vehicle_documents
  WHERE vehicle_id = ANY(v_vehicle_ids);

  DELETE FROM public.job_tracking_events
  WHERE created_by = p_user_id
     OR job_id = ANY(v_job_ids);

  DELETE FROM public.job_notes
  WHERE created_by = p_user_id
     OR job_id = ANY(v_job_ids);

  DELETE FROM public.job_documents
  WHERE uploaded_by = p_user_id
     OR company_id = ANY(v_company_ids)
     OR job_id = ANY(v_job_ids);

  DELETE FROM public.notification_events
  WHERE recipient_user_id = p_user_id
     OR company_id = ANY(v_company_ids);

  DELETE FROM public.job_disputes
  WHERE job_id = ANY(v_job_ids)
     OR raised_by_company_id = ANY(v_company_ids)
     OR resolved_by_user_id = p_user_id;

  DELETE FROM public.invoices
  WHERE created_by = p_user_id
     OR company_id = ANY(v_company_ids)
     OR job_id = ANY(v_job_ids);

  DELETE FROM public.job_bids
  WHERE bidder_user_id = p_user_id
     OR company_id = ANY(v_company_ids)
     OR job_id = ANY(v_job_ids);

  DELETE FROM public.jobs
  WHERE id = ANY(v_job_ids)
     OR company_id = ANY(v_company_ids);

  DELETE FROM public.owner_audit_log
  WHERE actor_user_id = p_user_id
     OR target_company_id = ANY(v_company_ids);

  DELETE FROM public.vehicles
  WHERE id = ANY(v_vehicle_ids)
     OR company_id = ANY(v_company_ids);

  DELETE FROM public.drivers
  WHERE id = ANY(v_driver_ids)
     OR user_id = p_user_id
     OR company_id = ANY(v_company_ids);

  DELETE FROM public.company_memberships
  WHERE user_id = p_user_id
     OR company_id = ANY(v_company_ids);

  DELETE FROM public.profiles
  WHERE user_id = p_user_id;

  DELETE FROM public.companies
  WHERE created_by = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'company_ids', v_company_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_gdpr_delete_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_gdpr_delete_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_gdpr_delete_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_gdpr_delete_user(uuid) TO service_role;

COMMIT;
