BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- SA-02: persistent Platform Owner case management.
-- This is intentionally separate from support_tickets, fraud_review_cases,
-- job_disputes and invoice_disputes. Those tables remain domain records.
-- platform_cases is the cross-domain operational exception/correlation layer.

CREATE SEQUENCE IF NOT EXISTS public.platform_case_reference_seq;

CREATE TABLE IF NOT EXISTS public.platform_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL DEFAULT (
    'PC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.platform_case_reference_seq')::text, 6, '0')
  ),
  source text NOT NULL,
  case_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('P0', 'P1', 'P2', 'P3')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'investigating', 'waiting', 'resolved', 'closed')),
  title text NOT NULL CHECK (length(btrim(title)) >= 3),
  description text,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_label text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  dedupe_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reference)
);

CREATE TABLE IF NOT EXISTS public.platform_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.platform_cases(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_cases_status_severity
  ON public.platform_cases(status, severity, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_cases_entity
  ON public.platform_cases(entity_type, entity_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_cases_company
  ON public.platform_cases(company_id, updated_at DESC)
  WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_cases_assignee
  ON public.platform_cases(assigned_to_user_id, status, updated_at DESC)
  WHERE assigned_to_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_cases_active_dedupe
  ON public.platform_cases(dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND status IN ('open', 'acknowledged', 'investigating', 'waiting');
CREATE INDEX IF NOT EXISTS idx_platform_case_events_case_created
  ON public.platform_case_events(case_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.platform_case_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_cases_updated_at ON public.platform_cases;
CREATE TRIGGER trg_platform_cases_updated_at
BEFORE UPDATE ON public.platform_cases
FOR EACH ROW
EXECUTE FUNCTION public.platform_case_touch_updated_at();

CREATE OR REPLACE FUNCTION public.assert_platform_owner_actor(p_actor_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_authorized boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_actor_user_id
      AND p.role::text = 'owner'
      AND COALESCE(p.status::text, 'active') = 'active'
  )
  INTO v_authorized;

  IF NOT COALESCE(v_authorized, false) THEN
    RAISE EXCEPTION 'Platform Owner authority required.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_create_platform_case(
  p_actor_user_id uuid,
  p_source text,
  p_case_type text,
  p_severity text,
  p_title text,
  p_description text,
  p_entity_type text,
  p_entity_id text,
  p_entity_label text,
  p_company_id uuid DEFAULT NULL,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_dedupe_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.platform_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_case public.platform_cases;
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  IF p_severity NOT IN ('P0', 'P1', 'P2', 'P3') THEN
    RAISE EXCEPTION 'Invalid case severity.' USING ERRCODE = '23514';
  END IF;
  IF length(btrim(COALESCE(p_source, ''))) < 2
     OR length(btrim(COALESCE(p_case_type, ''))) < 2
     OR length(btrim(COALESCE(p_title, ''))) < 3
     OR length(btrim(COALESCE(p_entity_type, ''))) < 2
     OR length(btrim(COALESCE(p_entity_id, ''))) < 1
     OR length(btrim(COALESCE(p_entity_label, ''))) < 1 THEN
    RAISE EXCEPTION 'Case source, type, title and entity identity are required.' USING ERRCODE = '23514';
  END IF;

  IF p_dedupe_key IS NOT NULL THEN
    SELECT pc.*
    INTO v_case
    FROM public.platform_cases pc
    WHERE pc.dedupe_key = p_dedupe_key
      AND pc.status IN ('open', 'acknowledged', 'investigating', 'waiting')
    ORDER BY pc.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN v_case;
    END IF;
  END IF;

  INSERT INTO public.platform_cases (
    source,
    case_type,
    severity,
    title,
    description,
    entity_type,
    entity_id,
    entity_label,
    company_id,
    assigned_to_user_id,
    created_by_user_id,
    dedupe_key,
    metadata
  )
  VALUES (
    btrim(p_source),
    btrim(p_case_type),
    p_severity,
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    btrim(p_entity_type),
    btrim(p_entity_id),
    btrim(p_entity_label),
    p_company_id,
    p_assigned_to_user_id,
    p_actor_user_id,
    NULLIF(btrim(COALESCE(p_dedupe_key, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_case;

  INSERT INTO public.platform_case_events (
    case_id,
    actor_user_id,
    event_type,
    old_status,
    new_status,
    reason,
    metadata
  )
  VALUES (
    v_case.id,
    p_actor_user_id,
    'case_created',
    NULL,
    v_case.status,
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    jsonb_build_object('source', v_case.source, 'case_type', v_case.case_type, 'severity', v_case.severity)
  );

  RETURN v_case;
EXCEPTION
  WHEN unique_violation THEN
    IF p_dedupe_key IS NOT NULL THEN
      SELECT pc.*
      INTO v_case
      FROM public.platform_cases pc
      WHERE pc.dedupe_key = p_dedupe_key
        AND pc.status IN ('open', 'acknowledged', 'investigating', 'waiting')
      ORDER BY pc.created_at DESC
      LIMIT 1;
      IF FOUND THEN
        RETURN v_case;
      END IF;
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_mutate_platform_case(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_action text,
  p_reason text DEFAULT NULL,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.platform_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_case public.platform_cases;
  v_old_status text;
  v_new_status text;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  SELECT *
  INTO v_case
  FROM public.platform_cases
  WHERE id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Platform case not found.' USING ERRCODE = 'P0002';
  END IF;

  v_old_status := v_case.status;
  v_new_status := v_case.status;

  IF p_action = 'assign' THEN
    IF p_assigned_to_user_id IS NULL THEN
      RAISE EXCEPTION 'Assignee is required.' USING ERRCODE = '23514';
    END IF;
    IF v_reason IS NULL OR length(v_reason) < 5 THEN
      RAISE EXCEPTION 'Assignment reason of at least 5 characters is required.' USING ERRCODE = '23514';
    END IF;
    UPDATE public.platform_cases
    SET assigned_to_user_id = p_assigned_to_user_id
    WHERE id = p_case_id
    RETURNING * INTO v_case;
  ELSIF p_action = 'acknowledge' THEN
    IF v_case.status <> 'open' THEN
      RAISE EXCEPTION 'Only open cases can be acknowledged.' USING ERRCODE = '23514';
    END IF;
    v_new_status := 'acknowledged';
    UPDATE public.platform_cases
    SET status = v_new_status,
        acknowledged_at = COALESCE(acknowledged_at, now()),
        assigned_to_user_id = COALESCE(p_assigned_to_user_id, assigned_to_user_id, p_actor_user_id)
    WHERE id = p_case_id
    RETURNING * INTO v_case;
  ELSIF p_action = 'investigate' THEN
    IF v_case.status NOT IN ('open', 'acknowledged', 'waiting') THEN
      RAISE EXCEPTION 'Case cannot enter investigation from its current state.' USING ERRCODE = '23514';
    END IF;
    v_new_status := 'investigating';
    UPDATE public.platform_cases
    SET status = v_new_status,
        acknowledged_at = COALESCE(acknowledged_at, now()),
        assigned_to_user_id = COALESCE(p_assigned_to_user_id, assigned_to_user_id, p_actor_user_id)
    WHERE id = p_case_id
    RETURNING * INTO v_case;
  ELSIF p_action = 'wait' THEN
    IF v_case.status NOT IN ('acknowledged', 'investigating') THEN
      RAISE EXCEPTION 'Only acknowledged or investigating cases can be placed in waiting.' USING ERRCODE = '23514';
    END IF;
    v_new_status := 'waiting';
    UPDATE public.platform_cases SET status = v_new_status WHERE id = p_case_id RETURNING * INTO v_case;
  ELSIF p_action = 'resolve' THEN
    IF v_case.status NOT IN ('acknowledged', 'investigating', 'waiting') THEN
      RAISE EXCEPTION 'Case cannot be resolved from its current state.' USING ERRCODE = '23514';
    END IF;
    v_new_status := 'resolved';
    UPDATE public.platform_cases
    SET status = v_new_status, resolved_at = now(), closed_at = NULL
    WHERE id = p_case_id
    RETURNING * INTO v_case;
  ELSIF p_action = 'close' THEN
    IF v_case.status <> 'resolved' THEN
      RAISE EXCEPTION 'Only resolved cases can be closed.' USING ERRCODE = '23514';
    END IF;
    v_new_status := 'closed';
    UPDATE public.platform_cases SET status = v_new_status, closed_at = now() WHERE id = p_case_id RETURNING * INTO v_case;
  ELSIF p_action = 'reopen' THEN
    IF v_case.status NOT IN ('resolved', 'closed') THEN
      RAISE EXCEPTION 'Only resolved or closed cases can be reopened.' USING ERRCODE = '23514';
    END IF;
    v_new_status := 'investigating';
    UPDATE public.platform_cases
    SET status = v_new_status,
        resolved_at = NULL,
        closed_at = NULL,
        assigned_to_user_id = COALESCE(p_assigned_to_user_id, assigned_to_user_id, p_actor_user_id)
    WHERE id = p_case_id
    RETURNING * INTO v_case;
  ELSE
    RAISE EXCEPTION 'Unsupported platform case action: %', p_action USING ERRCODE = '23514';
  END IF;

  IF p_action <> 'acknowledge' AND (v_reason IS NULL OR length(v_reason) < 5) THEN
    RAISE EXCEPTION 'A reason of at least 5 characters is required.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.platform_case_events (
    case_id,
    actor_user_id,
    event_type,
    old_status,
    new_status,
    reason,
    metadata
  )
  VALUES (
    v_case.id,
    p_actor_user_id,
    p_action,
    v_old_status,
    v_case.status,
    v_reason,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('assigned_to_user_id', v_case.assigned_to_user_id)
  );

  RETURN v_case;
END;
$$;

ALTER TABLE public.platform_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_case_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_case_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.platform_case_reference_seq FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_cases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_case_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.platform_case_reference_seq TO service_role;

REVOKE ALL ON FUNCTION public.platform_case_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_platform_owner_actor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_create_platform_case(uuid, text, text, text, text, text, text, text, text, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mutate_platform_case(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assert_platform_owner_actor(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_create_platform_case(uuid, text, text, text, text, text, text, text, text, uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_mutate_platform_case(uuid, uuid, text, text, uuid, jsonb) TO service_role;

COMMENT ON TABLE public.platform_cases IS
  'Cross-domain Platform Owner exception cases. Domain records remain authoritative; this table tracks human operational investigation and closure.';
COMMENT ON TABLE public.platform_case_events IS
  'Append-only semantic event trail for Platform Owner case lifecycle mutations.';

COMMIT;
