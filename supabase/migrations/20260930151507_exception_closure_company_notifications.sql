BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

CREATE OR REPLACE FUNCTION public.service_enqueue_exception_case_notifications(
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      pc.id AS case_id,
      pc.reference,
      pc.case_type,
      pc.severity,
      pc.status,
      pc.title,
      pc.entity_type,
      pc.entity_id,
      pc.entity_label,
      pc.company_id,
      pc.next_action,
      pc.next_action_due_at,
      pc.sla_due_at,
      pc.sla_breached_at,
      pc.customer_update_due_at,
      pc.customer_updated_at,
      pc.closure_due_at,
      pc.escalation_level,
      CASE
        WHEN pc.case_type IN ('invoice_generation_failed','delivered_without_invoice','payment_overdue','payment_disputed')
          THEN 'exception_finance_alert'
        WHEN pc.case_type IN ('pod_missing','pod_rejected')
          THEN 'exception_pod_alert'
        ELSE 'exception_operational_alert'
      END AS event_type
    FROM public.platform_cases pc
    WHERE pc.source='exception_closure_engine'
      AND pc.company_id IS NOT NULL
      AND pc.status IN ('open','acknowledged','investigating','waiting')
  ),
  routed AS (
    SELECT DISTINCT
      c.*,
      cm.user_id AS recipient_user_id
    FROM candidates c
    JOIN public.company_memberships cm
      ON cm.company_id=c.company_id
     AND lower(COALESCE(cm.status,''))='active'
     AND cm.user_id IS NOT NULL
    WHERE
      (
        c.event_type='exception_finance_alert'
        AND lower(COALESCE(cm.role_in_company,'')) IN ('owner','admin','finance')
      )
      OR
      (
        c.event_type='exception_pod_alert'
        AND lower(COALESCE(cm.role_in_company,'')) IN ('owner','admin','fleet_manager','dispatcher')
      )
      OR
      (
        c.event_type='exception_operational_alert'
        AND lower(COALESCE(cm.role_in_company,'')) IN ('owner','admin','fleet_manager','dispatcher')
      )
  ),
  inserted AS (
    INSERT INTO public.notification_events (
      event_type,
      entity_type,
      entity_id,
      company_id,
      recipient_user_id,
      payload,
      idempotency_key
    )
    SELECT
      r.event_type,
      'platform_case',
      r.case_id,
      r.company_id,
      r.recipient_user_id,
      jsonb_build_object(
        'case_id',r.case_id,
        'reference',r.reference,
        'case_type',r.case_type,
        'severity',r.severity,
        'status',r.status,
        'title',r.title,
        'entity_type',r.entity_type,
        'entity_id',r.entity_id,
        'entity_label',r.entity_label,
        'next_action',r.next_action,
        'next_action_due_at',r.next_action_due_at,
        'sla_due_at',r.sla_due_at,
        'sla_breached_at',r.sla_breached_at,
        'customer_update_due_at',r.customer_update_due_at,
        'customer_updated_at',r.customer_updated_at,
        'closure_due_at',r.closure_due_at,
        'escalation_level',r.escalation_level,
        'generated_at',p_now
      ),
      'exception-case:' || r.case_id::text || ':' || r.recipient_user_id::text || ':L' || r.escalation_level::text
    FROM routed r
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer INTO v_inserted FROM inserted;

  RETURN v_inserted;
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
  v_notifications integer := 0;
BEGIN
  v_operational := public.service_reconcile_exception_closure_engine(p_now);
  v_finance := public.service_reconcile_finance_exception_cases(p_now);
  v_notifications := public.service_enqueue_exception_case_notifications(p_now);

  RETURN jsonb_build_object(
    'operational',v_operational,
    'finance',v_finance,
    'notifications_enqueued',v_notifications,
    'reconciled_at',p_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.service_enqueue_exception_case_notifications(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_enqueue_exception_case_notifications(timestamptz)
  TO service_role;

COMMENT ON FUNCTION public.service_enqueue_exception_case_notifications(timestamptz) IS
  'Routes active company-scoped Exception Closure Engine cases to authorised company operators using idempotent notification_events.';

COMMENT ON FUNCTION public.service_reconcile_all_exception_closure(timestamptz) IS
  'Canonical minute-level reconciliation entry point for operational, finance, escalation and company notification routing.';

NOTIFY pgrst, 'reload schema';
COMMIT;
