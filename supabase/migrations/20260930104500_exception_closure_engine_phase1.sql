BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Exception & Closure Engine, Phase 1:
-- persist SLA, ageing, escalation and next-action obligations on canonical platform cases.

ALTER TABLE public.platform_cases
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_breached_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_update_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_due_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_cases_escalation_level_check'
      AND conrelid = 'public.platform_cases'::regclass
  ) THEN
    ALTER TABLE public.platform_cases
      ADD CONSTRAINT platform_cases_escalation_level_check
      CHECK (escalation_level >= 0 AND escalation_level <= 9);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_case_default_sla(
  p_severity text,
  p_detected_at timestamptz
)
RETURNS timestamptz
LANGUAGE sql`r`nSTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(p_detected_at, now()) +
    CASE upper(COALESCE(p_severity, 'P3'))
      WHEN 'P0' THEN interval '15 minutes'
      WHEN 'P1' THEN interval '30 minutes'
      WHEN 'P2' THEN interval '2 hours'
      ELSE interval '8 hours'
    END;
$$;

UPDATE public.platform_cases
SET sla_due_at = public.platform_case_default_sla(severity, detected_at)
WHERE sla_due_at IS NULL
  AND status IN ('open', 'acknowledged', 'investigating', 'waiting');

CREATE OR REPLACE FUNCTION public.platform_case_apply_sla_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at := public.platform_case_default_sla(NEW.severity, NEW.detected_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_cases_sla_defaults ON public.platform_cases;
CREATE TRIGGER trg_platform_cases_sla_defaults
BEFORE INSERT ON public.platform_cases
FOR EACH ROW
EXECUTE FUNCTION public.platform_case_apply_sla_defaults();

CREATE INDEX IF NOT EXISTS idx_platform_cases_active_sla
  ON public.platform_cases(sla_due_at, severity, detected_at)
  WHERE status IN ('open', 'acknowledged', 'investigating', 'waiting');

CREATE INDEX IF NOT EXISTS idx_platform_cases_next_action_due
  ON public.platform_cases(next_action_due_at, severity)
  WHERE status IN ('open', 'acknowledged', 'investigating', 'waiting')
    AND next_action_due_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.service_reconcile_platform_case_sla(
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (
  breached_count integer,
  escalated_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_breached integer := 0;
  v_escalated integer := 0;
BEGIN
  WITH breached AS (
    UPDATE public.platform_cases pc
    SET sla_breached_at = COALESCE(pc.sla_breached_at, p_now),
        escalated_at = COALESCE(pc.escalated_at, p_now),
        escalation_level = GREATEST(pc.escalation_level, 1),
        metadata = COALESCE(pc.metadata, '{}'::jsonb) || jsonb_build_object(
          'sla_state', 'breached',
          'sla_reconciled_at', p_now
        )
    WHERE pc.status IN ('open', 'acknowledged', 'investigating', 'waiting')
      AND pc.sla_due_at IS NOT NULL
      AND pc.sla_due_at <= p_now
      AND pc.sla_breached_at IS NULL
    RETURNING pc.id, pc.status, pc.sla_due_at, pc.created_by_user_id
  ),
  events AS (
    INSERT INTO public.platform_case_events (
      case_id, actor_user_id, event_type, old_status, new_status, reason, metadata
    )
    SELECT
      b.id,
      b.created_by_user_id,
      'sla_breached',
      b.status,
      b.status,
      'Case exceeded its operational SLA.',
      jsonb_build_object('sla_due_at', b.sla_due_at, 'reconciled_at', p_now)
    FROM breached b
    RETURNING case_id
  )
  SELECT count(*)::integer INTO v_breached FROM events;

  v_escalated := v_breached;
  RETURN QUERY SELECT v_breached, v_escalated;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_case_default_sla(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_case_apply_sla_defaults() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_reconcile_platform_case_sla(timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.platform_case_default_sla(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_reconcile_platform_case_sla(timestamptz) TO service_role;

COMMENT ON FUNCTION public.service_reconcile_platform_case_sla(timestamptz) IS
  'Persists first SLA breach/escalation for active Platform Case Centre records and writes a semantic system event.';
COMMENT ON COLUMN public.platform_cases.sla_due_at IS 'Operational SLA deadline for the active exception case.';
COMMENT ON COLUMN public.platform_cases.sla_breached_at IS 'First persisted time the case exceeded its SLA.';
COMMENT ON COLUMN public.platform_cases.escalated_at IS 'First persisted escalation time.';
COMMENT ON COLUMN public.platform_cases.escalation_level IS 'Persisted escalation depth; 0 means not escalated.';
COMMENT ON COLUMN public.platform_cases.next_action IS 'Human-readable next operational action required for this case.';
COMMENT ON COLUMN public.platform_cases.next_action_due_at IS 'Deadline for the next required operational action.';
COMMENT ON COLUMN public.platform_cases.customer_update_due_at IS 'Deadline for a required customer communication update.';
COMMENT ON COLUMN public.platform_cases.closure_due_at IS 'Deadline for verified operational/financial closure.';

COMMIT;

