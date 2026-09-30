BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.service_exception_engine_owner()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.user_id
  FROM public.profiles p
  WHERE lower(p.role::text) = 'owner'
    AND lower(COALESCE(p.status::text, 'active')) = 'active'
  ORDER BY p.created_at ASC, p.user_id ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.service_reconcile_platform_case_obligations(
  p_actor_user_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (
  auto_assigned_count integer,
  customer_update_escalated_count integer,
  closure_escalated_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_auto_assigned integer := 0;
  v_customer_escalated integer := 0;
  v_closure_escalated integer := 0;
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  WITH candidates AS (
    SELECT pc.id, pc.status
    FROM public.platform_cases pc
    WHERE pc.source = 'exception_closure_engine'
      AND pc.status IN ('open','acknowledged','investigating','waiting')
      AND pc.assigned_to_user_id IS NULL
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.platform_cases pc
    SET assigned_to_user_id = p_actor_user_id
    FROM candidates c
    WHERE pc.id = c.id
    RETURNING pc.id, pc.status
  ),
  events AS (
    INSERT INTO public.platform_case_events (
      case_id, actor_user_id, event_type, old_status, new_status, reason, metadata
    )
    SELECT u.id, p_actor_user_id, 'auto_assigned', u.status, u.status,
           'Automatic owner assignment by Exception Closure Engine.',
           jsonb_build_object('automatic',true,'reconciled_at',p_now)
    FROM updated u
    RETURNING case_id
  )
  SELECT count(*)::integer INTO v_auto_assigned FROM events;
  WITH candidates AS (
    SELECT pc.id, pc.status, pc.customer_update_due_at
    FROM public.platform_cases pc
    WHERE pc.source = 'exception_closure_engine'
      AND pc.status IN ('open','acknowledged','investigating','waiting')
      AND pc.customer_update_due_at IS NOT NULL
      AND pc.customer_updated_at IS NULL
      AND pc.customer_update_due_at <= p_now
      AND pc.escalation_level < 2
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.platform_cases pc
    SET escalation_level = 2,
        escalated_at = COALESCE(pc.escalated_at,p_now),
        metadata = COALESCE(pc.metadata,'{}'::jsonb) || jsonb_build_object(
          'customer_update_state','overdue',
          'customer_update_escalated_at',p_now
        )
    FROM candidates c
    WHERE pc.id = c.id
    RETURNING pc.id, pc.status, pc.customer_update_due_at
  ),
  events AS (
    INSERT INTO public.platform_case_events (
      case_id, actor_user_id, event_type, old_status, new_status, reason, metadata
    )
    SELECT u.id, p_actor_user_id, 'customer_update_overdue', u.status, u.status,
           'Required customer communication is overdue.',
           jsonb_build_object('customer_update_due_at',u.customer_update_due_at,'escalated_at',p_now)
    FROM updated u
    RETURNING case_id
  )
  SELECT count(*)::integer INTO v_customer_escalated FROM events;

  WITH candidates AS (
    SELECT pc.id, pc.status, pc.closure_due_at
    FROM public.platform_cases pc
    WHERE pc.source = 'exception_closure_engine'
      AND pc.status IN ('open','acknowledged','investigating','waiting','resolved')
      AND pc.closure_due_at IS NOT NULL
      AND pc.closure_verified_at IS NULL
      AND pc.closure_due_at <= p_now
      AND pc.escalation_level < 3
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.platform_cases pc
    SET escalation_level = 3,
        escalated_at = COALESCE(pc.escalated_at,p_now),
        metadata = COALESCE(pc.metadata,'{}'::jsonb) || jsonb_build_object(
          'closure_state','overdue',
          'closure_escalated_at',p_now
        )
    FROM candidates c
    WHERE pc.id = c.id
    RETURNING pc.id, pc.status, pc.closure_due_at
  ),
  events AS (
    INSERT INTO public.platform_case_events (
      case_id, actor_user_id, event_type, old_status, new_status, reason, metadata
    )
    SELECT u.id, p_actor_user_id, 'closure_overdue', u.status, u.status,
           'Verified operational closure is overdue.',
           jsonb_build_object('closure_due_at',u.closure_due_at,'escalated_at',p_now)
    FROM updated u
    RETURNING case_id
  )
  SELECT count(*)::integer INTO v_closure_escalated FROM events;

  RETURN QUERY SELECT v_auto_assigned, v_customer_escalated, v_closure_escalated;
END;
$$;
CREATE OR REPLACE FUNCTION public.service_upsert_job_exception_case(
  p_actor_user_id uuid,
  p_job_id uuid,
  p_company_id uuid,
  p_entity_label text,
  p_case_type text,
  p_severity text,
  p_title text,
  p_description text,
  p_next_action text,
  p_next_action_minutes integer,
  p_customer_update_minutes integer,
  p_closure_minutes integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_case public.platform_cases;
BEGIN
  SELECT *
  INTO v_case
  FROM public.owner_create_platform_case(
    p_actor_user_id,
    'exception_closure_engine',
    p_case_type,
    p_severity,
    p_title,
    p_description,
    'job',
    p_job_id::text,
    p_entity_label,
    p_company_id,
    p_actor_user_id,
    'exception:' || p_case_type || ':job:' || p_job_id::text,
    COALESCE(p_metadata,'{}'::jsonb)
  );

  IF v_case.next_action IS NULL THEN
    PERFORM public.owner_set_platform_case_plan(
      p_actor_user_id,
      v_case.id,
      p_next_action,
      now() + make_interval(mins => GREATEST(p_next_action_minutes,0)),
      CASE
        WHEN p_customer_update_minutes IS NULL THEN NULL
        ELSE now() + make_interval(mins => GREATEST(p_customer_update_minutes,0))
      END,
      now() + make_interval(mins => GREATEST(p_closure_minutes,0))
    );
  END IF;

  RETURN v_case.id;
END;
$$;
CREATE OR REPLACE FUNCTION public.service_reconcile_exception_closure_engine(
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid;
  v_job record;
  v_detected integer := 0;
  v_obligations record;
  v_sla record;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('xdrive-exception-closure-engine')) THEN
    RETURN jsonb_build_object('skipped',true,'reason','reconcile_already_running');
  END IF;

  v_actor := public.service_exception_engine_owner();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Exception Closure Engine requires an active Platform Owner.';
  END IF;

  FOR v_job IN
    SELECT j.*,
           COALESCE(NULLIF(j.load_id,''),NULLIF(j.your_ref,''),NULLIF(j.load_ref,''),left(j.id::text,8)) AS label,
           COALESCE(j.assigned_company_id,j.awarded_carrier_company_id,j.company_id,j.posted_by_company_id) AS case_company
    FROM public.jobs j
    WHERE COALESCE(j.is_test,false)=false
      AND lower(COALESCE(j.current_status,j.status,'')) IN ('allocated','accepted','on_my_way','on_my_way_to_pickup','on_site_pickup')
      AND COALESCE(j.collection_window_end,j.pickup_datetime) IS NOT NULL
      AND COALESCE(j.collection_window_end,j.pickup_datetime) < p_now
  LOOP
    PERFORM public.service_upsert_job_exception_case(
      v_actor,v_job.id,v_job.case_company,v_job.label,
      'pickup_overdue','P1','Collection is overdue',
      'The planned collection deadline has passed while the job remains in pre-collection execution.',
      'Confirm collection status, recovery ETA and customer communication.',
      15,15,120,
      jsonb_build_object('detector','pickup_overdue','job_status',COALESCE(v_job.current_status,v_job.status),'pickup_due_at',COALESCE(v_job.collection_window_end,v_job.pickup_datetime))
    );
    v_detected := v_detected + 1;
  END LOOP;
  FOR v_job IN
    SELECT j.*,
           COALESCE(NULLIF(j.load_id,''),NULLIF(j.your_ref,''),NULLIF(j.load_ref,''),left(j.id::text,8)) AS label,
           COALESCE(j.assigned_company_id,j.awarded_carrier_company_id,j.company_id,j.posted_by_company_id) AS case_company
    FROM public.jobs j
    WHERE COALESCE(j.is_test,false)=false
      AND lower(COALESCE(j.current_status,j.status,'')) IN ('allocated','accepted','on_my_way','on_my_way_to_pickup','on_site_pickup','loaded','collected','in_transit','on_my_way_to_delivery','on_site_delivery')
      AND COALESCE(j.delivery_window_end,j.delivery_datetime) IS NOT NULL
      AND COALESCE(j.delivery_window_end,j.delivery_datetime) < p_now
  LOOP
    PERFORM public.service_upsert_job_exception_case(
      v_actor,v_job.id,v_job.case_company,v_job.label,
      'delivery_overdue','P1','Delivery is overdue',
      'The planned delivery deadline has passed while the job remains in active execution.',
      'Confirm delivery position, recovery ETA and customer communication.',
      15,15,120,
      jsonb_build_object('detector','delivery_overdue','job_status',COALESCE(v_job.current_status,v_job.status),'delivery_due_at',COALESCE(v_job.delivery_window_end,v_job.delivery_datetime))
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_job IN
    SELECT j.*,
           COALESCE(NULLIF(j.load_id,''),NULLIF(j.your_ref,''),NULLIF(j.load_ref,''),left(j.id::text,8)) AS label,
           COALESCE(j.assigned_company_id,j.awarded_carrier_company_id,j.company_id,j.posted_by_company_id) AS case_company
    FROM public.jobs j
    WHERE COALESCE(j.is_test,false)=false
      AND lower(COALESCE(j.current_status,j.status,'')) IN ('on_my_way','on_my_way_to_pickup','on_site_pickup','loaded','collected','in_transit','on_my_way_to_delivery','on_site_delivery')
      AND COALESCE(j.status_updated_at,j.updated_at) < p_now - interval '30 minutes'
  LOOP
    PERFORM public.service_upsert_job_exception_case(
      v_actor,v_job.id,v_job.case_company,v_job.label,
      'driver_status_stale','P2','Driver status update is stale',
      'An executing job has not received a driver status update within the operational freshness window.',
      'Confirm driver progress and restore the current job status.',
      30,30,240,
      jsonb_build_object('detector','driver_status_stale','job_status',COALESCE(v_job.current_status,v_job.status),'status_updated_at',COALESCE(v_job.status_updated_at,v_job.updated_at))
    );
    v_detected := v_detected + 1;
  END LOOP;
  FOR v_job IN
    SELECT j.*,
           COALESCE(NULLIF(j.load_id,''),NULLIF(j.your_ref,''),NULLIF(j.load_ref,''),left(j.id::text,8)) AS label,
           COALESCE(j.assigned_company_id,j.awarded_carrier_company_id,j.company_id,j.posted_by_company_id) AS case_company
    FROM public.jobs j
    WHERE COALESCE(j.is_test,false)=false
      AND lower(COALESCE(j.current_status,j.status,'')) IN ('delivered','completed','invoiced','paid')
      AND COALESCE(j.pod_required,true)
      AND COALESCE(j.pod_generated,false)=false
  LOOP
    PERFORM public.service_upsert_job_exception_case(
      v_actor,v_job.id,v_job.case_company,v_job.label,
      'pod_missing','P2','POD is missing',
      'The job is operationally complete but required proof of delivery has not been generated.',
      'Request or complete the missing POD and verify delivery evidence.',
      120,NULL,480,
      jsonb_build_object('detector','pod_missing','job_status',COALESCE(v_job.current_status,v_job.status))
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_job IN
    SELECT j.*,
           COALESCE(NULLIF(j.load_id,''),NULLIF(j.your_ref,''),NULLIF(j.load_ref,''),left(j.id::text,8)) AS label,
           COALESCE(j.assigned_company_id,j.awarded_carrier_company_id,j.company_id,j.posted_by_company_id) AS case_company
    FROM public.jobs j
    WHERE COALESCE(j.is_test,false)=false
      AND lower(COALESCE(j.broker_pod_review_status,'')) IN ('rejected','missing_requested')
  LOOP
    PERFORM public.service_upsert_job_exception_case(
      v_actor,v_job.id,v_job.case_company,v_job.label,
      'pod_remediation','P1','POD requires remediation',
      'The recorded POD review requires replacement evidence or corrective action.',
      'Resolve the POD review issue and provide acceptable replacement evidence.',
      30,30,240,
      jsonb_build_object('detector','pod_remediation','pod_review_status',v_job.broker_pod_review_status)
    );
    v_detected := v_detected + 1;
  END LOOP;
  FOR v_job IN
    SELECT j.*,
           COALESCE(NULLIF(j.load_id,''),NULLIF(j.your_ref,''),NULLIF(j.load_ref,''),left(j.id::text,8)) AS label,
           COALESCE(j.assigned_company_id,j.awarded_carrier_company_id,j.company_id,j.posted_by_company_id) AS case_company
    FROM public.jobs j
    WHERE COALESCE(j.is_test,false)=false
      AND lower(COALESCE(j.current_status,j.status,'')) IN ('delivered','completed')
      AND COALESCE(j.delivered_at,j.completed_at,j.status_updated_at,j.updated_at) < p_now - interval '10 minutes'
      AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.job_id=j.id)
  LOOP
    PERFORM public.service_upsert_job_exception_case(
      v_actor,v_job.id,v_job.case_company,v_job.label,
      'delivered_without_invoice','P1','Delivered job has no invoice',
      'The job is delivered or completed but no invoice record exists after the closure grace period.',
      'Investigate invoice generation and restore the job-to-invoice closure path.',
      30,NULL,120,
      jsonb_build_object('detector','delivered_without_invoice','job_status',COALESCE(v_job.current_status,v_job.status))
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_job IN
    SELECT j.*,
           COALESCE(NULLIF(j.load_id,''),NULLIF(j.your_ref,''),NULLIF(j.load_ref,''),left(j.id::text,8)) AS label,
           COALESCE(j.assigned_company_id,j.awarded_carrier_company_id,j.company_id,j.posted_by_company_id) AS case_company
    FROM public.jobs j
    WHERE COALESCE(j.is_test,false)=false
      AND (lower(COALESCE(j.current_status,j.status,''))='awarded' OR j.awarded_carrier_company_id IS NOT NULL OR j.assigned_company_id IS NOT NULL)
      AND j.assigned_driver_id IS NULL
      AND COALESCE(j.collection_window_start,j.pickup_datetime) BETWEEN p_now AND p_now + interval '60 minutes'
  LOOP
    PERFORM public.service_upsert_job_exception_case(
      v_actor,v_job.id,v_job.case_company,v_job.label,
      'job_unallocated_collection_imminent','P1','Collection is imminent and unallocated',
      'An awarded job is approaching collection without an assigned driver.',
      'Allocate a driver and confirm the collection plan.',
      15,NULL,60,
      jsonb_build_object('detector','job_unallocated_collection_imminent','collection_at',COALESCE(v_job.collection_window_start,v_job.pickup_datetime))
    );
    v_detected := v_detected + 1;
  END LOOP;
  FOR v_job IN
    SELECT j.*,
           COALESCE(NULLIF(j.load_id,''),NULLIF(j.your_ref,''),NULLIF(j.load_ref,''),left(j.id::text,8)) AS label,
           COALESCE(j.assigned_company_id,j.awarded_carrier_company_id,j.company_id,j.posted_by_company_id) AS case_company
    FROM public.jobs j
    WHERE COALESCE(j.is_test,false)=false
      AND j.assigned_driver_id IS NOT NULL
      AND lower(COALESCE(j.current_status,j.status,'')) IN ('on_my_way','on_my_way_to_pickup','on_site_pickup','loaded','collected','in_transit','on_my_way_to_delivery','on_site_delivery')
      AND COALESCE(j.status_updated_at,j.updated_at) < p_now - interval '3 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM public.driver_locations dl
        WHERE dl.driver_id=j.assigned_driver_id
          AND dl.recorded_at >= p_now - interval '3 minutes'
      )
  LOOP
    PERFORM public.service_upsert_job_exception_case(
      v_actor,v_job.id,v_job.case_company,v_job.label,
      'driver_gps_stale','P2','Driver GPS is stale',
      'An executing job has no fresh driver GPS position inside the tracking freshness window.',
      'Restore live tracking or confirm the driver position manually.',
      30,30,240,
      jsonb_build_object('detector','driver_gps_stale','job_status',COALESCE(v_job.current_status,v_job.status))
    );
    v_detected := v_detected + 1;
  END LOOP;

  SELECT * INTO v_sla
  FROM public.service_reconcile_platform_case_sla(p_now);

  SELECT * INTO v_obligations
  FROM public.service_reconcile_platform_case_obligations(v_actor,p_now);

  RETURN jsonb_build_object(
    'skipped',false,
    'detected',v_detected,
    'auto_assigned',COALESCE(v_obligations.auto_assigned_count,0),
    'sla_breached',COALESCE(v_sla.breached_count,0),
    'customer_update_escalated',COALESCE(v_obligations.customer_update_escalated_count,0),
    'closure_escalated',COALESCE(v_obligations.closure_escalated_count,0),
    'reconciled_at',p_now
  );
END;
$$;
REVOKE ALL ON FUNCTION public.service_exception_engine_owner()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_reconcile_platform_case_obligations(uuid,timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_upsert_job_exception_case(uuid,uuid,uuid,text,text,text,text,text,text,integer,integer,integer,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_reconcile_exception_closure_engine(timestamptz)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.service_exception_engine_owner() TO service_role;
GRANT EXECUTE ON FUNCTION public.service_reconcile_platform_case_obligations(uuid,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_upsert_job_exception_case(uuid,uuid,uuid,text,text,text,text,text,text,integer,integer,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_reconcile_exception_closure_engine(timestamptz) TO service_role;

COMMENT ON FUNCTION public.service_reconcile_exception_closure_engine(timestamptz) IS
  'Runs deterministic job/POD/invoice/tracking detection, SLA persistence, ownership assignment and obligation escalation.';

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname='xdrive-exception-closure-reconcile'
  ORDER BY jobid DESC
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END;
$$;

SELECT cron.schedule(
  'xdrive-exception-closure-reconcile',
  '* * * * *',
  $cron$SELECT public.service_reconcile_exception_closure_engine();$cron$
);

NOTIFY pgrst, 'reload schema';
COMMIT;
