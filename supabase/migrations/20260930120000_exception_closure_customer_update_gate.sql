BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

ALTER TABLE public.platform_cases
  ADD COLUMN IF NOT EXISTS customer_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_update_note text,
  ADD COLUMN IF NOT EXISTS closure_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closure_evidence text;

CREATE INDEX IF NOT EXISTS idx_platform_cases_customer_update_due
  ON public.platform_cases(customer_update_due_at, severity)
  WHERE status IN ('open', 'acknowledged', 'investigating', 'waiting')
    AND customer_update_due_at IS NOT NULL
    AND customer_updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.platform_case_enforce_closure_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status IN ('resolved', 'closed')
     AND NEW.status = 'investigating' THEN
    NEW.closure_verified_at := NULL;
    NEW.closure_verified_by := NULL;
    NEW.closure_evidence := NULL;
    IF NEW.customer_update_due_at IS NOT NULL THEN
      NEW.customer_updated_at := NULL;
      NEW.customer_update_note := NULL;
    END IF;
  END IF;

  IF NEW.status IN ('resolved', 'closed')
     AND NEW.customer_update_due_at IS NOT NULL
     AND NEW.customer_updated_at IS NULL THEN
    RAISE EXCEPTION 'Customer update obligation must be completed before resolution.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'closed'
     AND NEW.closure_verified_at IS NULL THEN
    RAISE EXCEPTION 'Verified closure evidence is required before closing a platform case.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_platform_cases_closure_integrity ON public.platform_cases;
CREATE TRIGGER trg_platform_cases_closure_integrity
BEFORE UPDATE OF status ON public.platform_cases
FOR EACH ROW
EXECUTE FUNCTION public.platform_case_enforce_closure_integrity();

CREATE OR REPLACE FUNCTION public.owner_record_platform_case_customer_update(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_note text,
  p_channel text DEFAULT 'manual'
)
RETURNS public.platform_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_case public.platform_cases;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_channel text := NULLIF(btrim(COALESCE(p_channel, '')), '');
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  IF v_note IS NULL OR length(v_note) < 5 THEN
    RAISE EXCEPTION 'Customer update evidence must contain at least 5 characters.'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.platform_cases
  SET customer_updated_at = now(),
      customer_update_note = v_note
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Platform case not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.platform_case_events (
    case_id, actor_user_id, event_type, old_status, new_status, reason, metadata
  ) VALUES (
    v_case.id,
    p_actor_user_id,
    'customer_updated',
    v_case.status,
    v_case.status,
    v_note,
    jsonb_build_object(
      'channel', COALESCE(v_channel, 'manual'),
      'customer_updated_at', v_case.customer_updated_at,
      'customer_update_due_at', v_case.customer_update_due_at
    )
  );

  RETURN v_case;
END;
$$;
CREATE OR REPLACE FUNCTION public.owner_verify_platform_case_closure(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_evidence text
)
RETURNS public.platform_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_case public.platform_cases;
  v_evidence text := NULLIF(btrim(COALESCE(p_evidence, '')), '');
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  IF v_evidence IS NULL OR length(v_evidence) < 5 THEN
    RAISE EXCEPTION 'Closure evidence must contain at least 5 characters.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_case
  FROM public.platform_cases
  WHERE id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Platform case not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_case.status <> 'resolved' THEN
    RAISE EXCEPTION 'Only resolved cases can receive final closure verification.'
      USING ERRCODE = '23514';
  END IF;

  IF v_case.customer_update_due_at IS NOT NULL
     AND v_case.customer_updated_at IS NULL THEN
    RAISE EXCEPTION 'Customer update obligation must be completed before closure verification.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.platform_cases
  SET closure_verified_at = now(),
      closure_verified_by = p_actor_user_id,
      closure_evidence = v_evidence
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO public.platform_case_events (
    case_id, actor_user_id, event_type, old_status, new_status, reason, metadata
  ) VALUES (
    v_case.id,
    p_actor_user_id,
    'closure_verified',
    v_case.status,
    v_case.status,
    v_evidence,
    jsonb_build_object('closure_verified_at', v_case.closure_verified_at)
  );

  RETURN v_case;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_case_enforce_closure_integrity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_record_platform_case_customer_update(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_verify_platform_case_closure(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.owner_record_platform_case_customer_update(uuid, uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_verify_platform_case_closure(uuid, uuid, text)
  TO service_role;

COMMENT ON COLUMN public.platform_cases.customer_updated_at IS
  'Time the required operational customer communication was recorded as completed.';
COMMENT ON COLUMN public.platform_cases.customer_update_note IS
  'Audit evidence describing the customer communication that satisfied the update obligation.';
COMMENT ON COLUMN public.platform_cases.closure_verified_at IS
  'Time final closure evidence was independently recorded after resolution.';
COMMENT ON COLUMN public.platform_cases.closure_verified_by IS
  'Platform Owner who verified closure evidence.';
COMMENT ON COLUMN public.platform_cases.closure_evidence IS
  'Human-readable evidence proving operational closure before the case is closed.';

COMMIT;
