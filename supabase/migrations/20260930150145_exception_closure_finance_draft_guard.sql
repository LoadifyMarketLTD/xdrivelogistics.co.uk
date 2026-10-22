BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Align the legacy POD remediation detector with the canonical detector contract
-- without creating a second active case for the same job.
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
  v_case_type text := p_case_type;
  v_severity text := p_severity;
  v_title text := p_title;
  v_description text := p_description;
  v_next_action text := p_next_action;
  v_next_action_minutes integer := p_next_action_minutes;
  v_customer_update_minutes integer := p_customer_update_minutes;
  v_closure_minutes integer := p_closure_minutes;
  v_review_status text := lower(COALESCE(p_metadata->>'pod_review_status',''));
  v_upgrade_plan boolean := false;
BEGIN
  IF p_case_type = 'pod_remediation' AND v_review_status = 'rejected' THEN
    v_case_type := 'pod_rejected';
    v_severity := 'P1';
    v_title := 'POD was rejected';
    v_description := 'The recorded proof of delivery was rejected and requires replacement evidence or corrective action.';
    v_next_action := 'Resolve the POD rejection and provide acceptable replacement evidence.';
    v_next_action_minutes := 30;
    v_customer_update_minutes := 30;
    v_closure_minutes := 240;
  ELSIF p_case_type = 'pod_remediation' AND v_review_status = 'missing_requested' THEN
    v_case_type := 'pod_missing';
    v_severity := 'P1';
    v_title := 'POD is missing';
    v_description := 'The job requires proof of delivery evidence that is not currently accepted as complete.';
    v_next_action := 'Request or complete the missing POD and verify delivery evidence.';
    v_next_action_minutes := 30;
    v_customer_update_minutes := 30;
    v_closure_minutes := 240;
  END IF;

  SELECT *
  INTO v_case
  FROM public.owner_create_platform_case(
    p_actor_user_id,
    'exception_closure_engine',
    v_case_type,
    v_severity,
    v_title,
    v_description,
    'job',
    p_job_id::text,
    p_entity_label,
    p_company_id,
    p_actor_user_id,
    'exception:' || v_case_type || ':job:' || p_job_id::text,
    COALESCE(p_metadata,'{}'::jsonb) || jsonb_build_object('normalized_case_type',v_case_type)
  );

  v_upgrade_plan := p_case_type = 'pod_remediation'
    AND (
      v_case.severity <> v_severity
      OR (v_customer_update_minutes IS NOT NULL AND v_case.customer_update_due_at IS NULL)
    );

  IF v_upgrade_plan THEN
    UPDATE public.platform_cases
    SET severity = v_severity,
        title = v_title,
        description = v_description,
        metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
          'normalized_case_type',v_case_type,
          'pod_review_status',NULLIF(v_review_status,'')
        )
    WHERE id = v_case.id;
  END IF;

  IF v_case.next_action IS NULL OR v_upgrade_plan THEN
    PERFORM public.owner_set_platform_case_plan(
      p_actor_user_id,
      v_case.id,
      v_next_action,
      now() + make_interval(mins => GREATEST(v_next_action_minutes,0)),
      CASE
        WHEN v_customer_update_minutes IS NULL THEN NULL
        ELSE now() + make_interval(mins => GREATEST(v_customer_update_minutes,0))
      END,
      now() + make_interval(mins => GREATEST(v_closure_minutes,0))
    );
  END IF;

  RETURN v_case.id;
END;
$$;
CREATE OR REPLACE FUNCTION public.service_upsert_invoice_exception_case(
  p_actor_user_id uuid,
  p_invoice_id uuid,
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
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  SELECT *
  INTO v_case
  FROM public.owner_create_platform_case(
    p_actor_user_id,
    'exception_closure_engine',
    p_case_type,
    p_severity,
    p_title,
    p_description,
    'invoice',
    p_invoice_id::text,
    p_entity_label,
    p_company_id,
    p_actor_user_id,
    'exception:' || p_case_type || ':invoice:' || p_invoice_id::text,
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
CREATE OR REPLACE FUNCTION public.service_reconcile_finance_exception_cases(
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid;
  v_event record;
  v_invoice record;
  v_detected integer := 0;
  v_sla record;
  v_obligations record;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('xdrive-finance-exception-engine')) THEN
    RETURN jsonb_build_object('skipped',true,'reason','finance_reconcile_already_running');
  END IF;

  v_actor := public.service_exception_engine_owner();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Finance Exception Engine requires an active Platform Owner.';
  END IF;

  FOR v_event IN
    SELECT DISTINCT ON (e.job_id)
           e.job_id,
           e.message,
           COALESCE(e.event_time,e.created_at) AS failure_at,
           COALESCE(NULLIF(j.load_id,''),NULLIF(j.your_ref,''),NULLIF(j.load_ref,''),left(j.id::text,8)) AS label,
           COALESCE(j.assigned_company_id,j.awarded_carrier_company_id,j.company_id,j.posted_by_company_id) AS case_company
    FROM public.job_tracking_events e
    JOIN public.jobs j ON j.id=e.job_id
    WHERE e.event_type='invoice_generation_failed'
      AND COALESCE(j.is_test,false)=false
      AND COALESCE(e.event_time,e.created_at) >= p_now - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.job_id=e.job_id)
    ORDER BY e.job_id, COALESCE(e.event_time,e.created_at) DESC
  LOOP
    PERFORM public.service_upsert_job_exception_case(
      v_actor,v_event.job_id,v_event.case_company,v_event.label,
      'invoice_generation_failed','P1','Automatic invoice generation failed',
      'A delivered or completed job recorded an automatic invoice generation failure and no invoice currently exists.',
      'Investigate the invoice generation failure and restore the job-to-invoice closure path.',
      30,NULL,120,
      jsonb_build_object('detector','invoice_generation_failed','failure_message',v_event.message,'failure_recorded_at',v_event.failure_at)
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_invoice IN
    SELECT i.*,
           COALESCE(NULLIF(i.invoice_number,''),NULLIF(i.load_id,''),NULLIF(i.job_ref,''),left(i.id::text,8)) AS label,
           COALESCE(i.supplier_company_id,i.company_id,i.buyer_company_id) AS case_company,
           COALESCE(i.due_date, i.issue_date + COALESCE(i.payment_due_days,30)) AS effective_due_date
    FROM public.invoices i
    JOIN public.jobs j ON j.id=i.job_id
    WHERE COALESCE(j.is_test,false)=false
      AND COALESCE(i.due_date, i.issue_date + COALESCE(i.payment_due_days,30)) IS NOT NULL
      AND COALESCE(i.due_date, i.issue_date + COALESCE(i.payment_due_days,30)) < p_now::date
      AND lower(COALESCE(i.payment_status::text,'')) IN ('unpaid','partially_paid','overdue')
      AND lower(COALESCE(i.status::text,'')) NOT IN ('paid','void','draft','cancelled','canceled')
  LOOP
    PERFORM public.service_upsert_invoice_exception_case(
      v_actor,v_invoice.id,v_invoice.case_company,v_invoice.label,
      'payment_overdue','P2','Invoice payment is overdue',
      'The invoice has passed its payment due date and remains unpaid or partially paid.',
      'Review the receivable, confirm payment position and record the agreed follow-up.',
      120,120,1440,
      jsonb_build_object(
        'detector','payment_overdue',
        'job_id',v_invoice.job_id,
        'due_date',v_invoice.effective_due_date,
        'payment_status',v_invoice.payment_status,
        'invoice_status',v_invoice.status
      )
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_invoice IN
    SELECT i.*,
           COALESCE(NULLIF(i.invoice_number,''),NULLIF(i.load_id,''),NULLIF(i.job_ref,''),left(i.id::text,8)) AS label,
           COALESCE(i.supplier_company_id,i.company_id,i.buyer_company_id) AS case_company
    FROM public.invoices i
    JOIN public.jobs j ON j.id=i.job_id
    WHERE COALESCE(j.is_test,false)=false
      AND (
        lower(COALESCE(i.payment_status::text,''))='disputed'
        OR lower(COALESCE(i.status::text,''))='disputed'
      )
  LOOP
    PERFORM public.service_upsert_invoice_exception_case(
      v_actor,v_invoice.id,v_invoice.case_company,v_invoice.label,
      'payment_disputed','P1','Invoice payment is disputed',
      'The invoice or payment record is marked disputed and requires active finance resolution.',
      'Review the dispute evidence, identify the owner and agree the next resolution step.',
      30,30,480,
      jsonb_build_object(
        'detector','payment_disputed',
        'job_id',v_invoice.job_id,
        'disputed_at',v_invoice.disputed_at,
        'payment_status',v_invoice.payment_status,
        'invoice_status',v_invoice.status
      )
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
    'sla_breached',COALESCE(v_sla.breached_count,0),
    'auto_assigned',COALESCE(v_obligations.auto_assigned_count,0),
    'customer_update_escalated',COALESCE(v_obligations.customer_update_escalated_count,0),
    'closure_escalated',COALESCE(v_obligations.closure_escalated_count,0),
    'reconciled_at',p_now
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.service_reconcile_all_exception_closure(
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operational jsonb;
  v_finance jsonb;
BEGIN
  v_operational := public.service_reconcile_exception_closure_engine(p_now);
  v_finance := public.service_reconcile_finance_exception_cases(p_now);

  RETURN jsonb_build_object(
    'operational',v_operational,
    'finance',v_finance,
    'reconciled_at',p_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.service_upsert_job_exception_case(uuid,uuid,uuid,text,text,text,text,text,text,integer,integer,integer,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_upsert_invoice_exception_case(uuid,uuid,uuid,text,text,text,text,text,text,integer,integer,integer,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_reconcile_finance_exception_cases(timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_reconcile_all_exception_closure(timestamptz)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.service_upsert_job_exception_case(uuid,uuid,uuid,text,text,text,text,text,text,integer,integer,integer,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.service_upsert_invoice_exception_case(uuid,uuid,uuid,text,text,text,text,text,text,integer,integer,integer,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.service_reconcile_finance_exception_cases(timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.service_reconcile_all_exception_closure(timestamptz)
  TO service_role;

COMMENT ON FUNCTION public.service_reconcile_finance_exception_cases(timestamptz) IS
  'Reconciles persisted invoice-generation failures plus overdue and disputed invoice payment exceptions.';
COMMENT ON FUNCTION public.service_reconcile_all_exception_closure(timestamptz) IS
  'Canonical minute-level reconciliation entry point for operational and finance exception domains.';

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
  $cron$SELECT public.service_reconcile_all_exception_closure();$cron$
);

NOTIFY pgrst, 'reload schema';
COMMIT;
