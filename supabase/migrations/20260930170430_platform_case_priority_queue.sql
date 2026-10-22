BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

ALTER TABLE public.platform_cases
  ADD COLUMN IF NOT EXISTS priority_bucket integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS priority_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_platform_cases_priority_queue
  ON public.platform_cases(priority_bucket, sla_due_at, updated_at DESC)
  WHERE status IN ('open','acknowledged','investigating','waiting');

CREATE OR REPLACE FUNCTION public.service_refresh_platform_case_priority(
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.platform_cases pc
  SET priority_bucket = CASE
        WHEN pc.status NOT IN ('open','acknowledged','investigating','waiting') THEN 90
        WHEN pc.sla_breached_at IS NOT NULL AND pc.severity = 'P0' THEN 10
        WHEN pc.sla_breached_at IS NOT NULL AND pc.severity = 'P1' THEN 20
        WHEN pc.assigned_to_user_id IS NULL THEN 30
        WHEN pc.sla_due_at IS NOT NULL AND pc.sla_due_at <= p_now + interval '30 minutes' THEN 40
        ELSE 50
      END,
      priority_updated_at = p_now
  WHERE pc.priority_bucket IS DISTINCT FROM CASE
        WHEN pc.status NOT IN ('open','acknowledged','investigating','waiting') THEN 90
        WHEN pc.sla_breached_at IS NOT NULL AND pc.severity = 'P0' THEN 10
        WHEN pc.sla_breached_at IS NOT NULL AND pc.severity = 'P1' THEN 20
        WHEN pc.assigned_to_user_id IS NULL THEN 30
        WHEN pc.sla_due_at IS NOT NULL AND pc.sla_due_at <= p_now + interval '30 minutes' THEN 40
        ELSE 50
      END
     OR pc.priority_updated_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.service_refresh_platform_case_priority(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_refresh_platform_case_priority(timestamptz)
  TO service_role;

COMMENT ON COLUMN public.platform_cases.priority_bucket IS
  'Persisted Action Centre ordering bucket: 10 breached P0, 20 breached P1, 30 unowned active, 40 SLA due within 30 minutes, 50 remaining active, 90 non-active.';
COMMENT ON FUNCTION public.service_refresh_platform_case_priority(timestamptz) IS
  'Persists deterministic Action Centre priority ordering from canonical case state.';

SELECT public.service_refresh_platform_case_priority(now());

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
  v_priority_updated integer := 0;
BEGIN
  v_operational := public.service_reconcile_exception_closure_engine(p_now);
  v_finance := public.service_reconcile_finance_exception_cases(p_now);
  v_priority_updated := public.service_refresh_platform_case_priority(p_now);
  v_notifications := public.service_enqueue_exception_case_notifications(p_now);

  RETURN jsonb_build_object(
    'operational',v_operational,
    'finance',v_finance,
    'priority_updated',v_priority_updated,
    'notifications_enqueued',v_notifications,
    'reconciled_at',p_now
  );
END;
$$;

COMMENT ON FUNCTION public.service_reconcile_all_exception_closure(timestamptz) IS
  'Canonical minute-level reconciliation entry point for operational, finance, priority, escalation and company notification routing.';

NOTIFY pgrst, 'reload schema';
COMMIT;
