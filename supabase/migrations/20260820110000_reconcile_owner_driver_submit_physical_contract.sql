-- PreLive Guardian remediation: keep owner-driver onboarding compatible with the
-- current physical public.drivers contract.
--
-- The preserved submit_onboarding_application_base_v1(uuid) implementation was
-- authored before drivers.name/full_name became required physical columns. The
-- public wrapper introduced later delegates to that preserved base function, so
-- owner-driver submit can otherwise fail with NOT NULL violations.
--
-- This migration patches only the owner-driver INSERT inside the preserved base
-- implementation. It accepts exactly the two historical VALUES shapes observed
-- in the canonical fresh rebuild and XDrive Production, and fails closed on any
-- other shape. It does not change onboarding policy, approval semantics,
-- Workspace/Super Admin UI, or public RPC permissions.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE
  v_oid oid;
  v_def text;
  v_old_columns_pattern text :=
    'INSERT[[:space:]]+INTO[[:space:]]+public\.drivers[[:space:]]*\([[:space:]]*company_id,[[:space:]]*user_id,[[:space:]]*display_name,';
  v_new_columns_pattern text :=
    'INSERT[[:space:]]+INTO[[:space:]]+public\.drivers[[:space:]]*\([[:space:]]*company_id,[[:space:]]*user_id,[[:space:]]*name,[[:space:]]*full_name,[[:space:]]*display_name,';

  -- Fresh/canonical base function: display_name already uses the email fallback.
  v_old_values_fresh_pattern text :=
    'VALUES[[:space:]]*\([[:space:]]*v_company_id,[[:space:]]*v_app\.user_id,[[:space:]]*COALESCE\(NULLIF\(trim\(v_app\.payload->>''full_name''\),[[:space:]]*''''\),[[:space:]]*split_part\(v_app\.email,[[:space:]]*''@'',[[:space:]]*1\)\),';
  v_new_values_fresh_pattern text :=
    'VALUES[[:space:]]*\([[:space:]]*v_company_id,[[:space:]]*v_app\.user_id,[[:space:]]*COALESCE\(NULLIF\(trim\(v_app\.payload->>''full_name''\),[[:space:]]*''''\),[[:space:]]*split_part\(v_app\.email,[[:space:]]*''@'',[[:space:]]*1\)\),[[:space:]]*COALESCE\(NULLIF\(trim\(v_app\.payload->>''full_name''\),[[:space:]]*''''\),[[:space:]]*split_part\(v_app\.email,[[:space:]]*''@'',[[:space:]]*1\)\),[[:space:]]*COALESCE\(NULLIF\(trim\(v_app\.payload->>''full_name''\),[[:space:]]*''''\),[[:space:]]*split_part\(v_app\.email,[[:space:]]*''@'',[[:space:]]*1\)\),';

  -- XDrive Production historical base function: display_name uses payload full_name
  -- directly and the remaining driver fields follow on the same INSERT/VALUES.
  v_old_values_live_pattern text :=
    'VALUES[[:space:]]*\([[:space:]]*v_company_id,[[:space:]]*v_app\.user_id,[[:space:]]*v_app\.payload->>''full_name'',';
  v_new_values_live_pattern text :=
    'VALUES[[:space:]]*\([[:space:]]*v_company_id,[[:space:]]*v_app\.user_id,[[:space:]]*COALESCE\(NULLIF\(trim\(v_app\.payload->>''full_name''\),[[:space:]]*''''\),[[:space:]]*split_part\(v_app\.email,[[:space:]]*''@'',[[:space:]]*1\)\),[[:space:]]*COALESCE\(NULLIF\(trim\(v_app\.payload->>''full_name''\),[[:space:]]*''''\),[[:space:]]*split_part\(v_app\.email,[[:space:]]*''@'',[[:space:]]*1\)\),[[:space:]]*v_app\.payload->>''full_name'',';

  v_new_columns text := E'INSERT INTO public.drivers (\n        company_id,\n        user_id,\n        name,\n        full_name,\n        display_name,';
  v_new_values_fresh text := E'VALUES (\n        v_company_id,\n        v_app.user_id,\n        COALESCE(NULLIF(trim(v_app.payload->>''full_name''), ''''), split_part(v_app.email, ''@'', 1)),\n        COALESCE(NULLIF(trim(v_app.payload->>''full_name''), ''''), split_part(v_app.email, ''@'', 1)),\n        COALESCE(NULLIF(trim(v_app.payload->>''full_name''), ''''), split_part(v_app.email, ''@'', 1)),';
  v_new_values_live text := E'VALUES (\n        v_company_id,\n        v_app.user_id,\n        COALESCE(NULLIF(trim(v_app.payload->>''full_name''), ''''), split_part(v_app.email, ''@'', 1)),\n        COALESCE(NULLIF(trim(v_app.payload->>''full_name''), ''''), split_part(v_app.email, ''@'', 1)),\n        v_app.payload->>''full_name'',';

  v_old_columns_count integer;
  v_new_columns_count integer;
  v_old_values_fresh_count integer;
  v_old_values_live_count integer;
  v_new_values_fresh_count integer;
  v_new_values_live_count integer;
  v_old_values_total integer;
  v_new_values_total integer;
BEGIN
  v_oid := to_regprocedure('public.submit_onboarding_application_base_v1(uuid)');

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'submit_onboarding_application_base_v1(uuid) is missing; refusing onboarding rewrite.'
      USING ERRCODE = '42883';
  END IF;

  SELECT pg_get_functiondef(v_oid)
  INTO v_def;

  -- pg_get_functiondef() normalises whitespace. Match semantic token order rather
  -- than source indentation, and require exactly one owner-driver INSERT shape.
  v_old_columns_count := regexp_count(v_def, v_old_columns_pattern, 1, 'i');
  v_new_columns_count := regexp_count(v_def, v_new_columns_pattern, 1, 'i');
  v_old_values_fresh_count := regexp_count(v_def, v_old_values_fresh_pattern, 1, 'i');
  v_old_values_live_count := regexp_count(v_def, v_old_values_live_pattern, 1, 'i');
  v_new_values_fresh_count := regexp_count(v_def, v_new_values_fresh_pattern, 1, 'i');
  v_new_values_live_count := regexp_count(v_def, v_new_values_live_pattern, 1, 'i');
  v_old_values_total := v_old_values_fresh_count + v_old_values_live_count;
  v_new_values_total := v_new_values_fresh_count + v_new_values_live_count;

  -- Idempotent on an already-reconciled environment, for either known shape.
  IF v_new_columns_count = 1 THEN
    IF v_new_values_total <> 1 OR v_old_values_total <> 0 THEN
      RAISE EXCEPTION 'Owner-driver submit columns are reconciled but values are not canonical; refusing partial rewrite.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF v_new_columns_count <> 0 OR v_old_columns_count <> 1 THEN
      RAISE EXCEPTION 'Unexpected owner-driver INSERT shape in submit_onboarding_application_base_v1; refusing broad rewrite.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_new_values_total <> 0 OR v_old_values_total <> 1 THEN
      RAISE EXCEPTION 'Unexpected owner-driver VALUES shape in submit_onboarding_application_base_v1; refusing broad rewrite.'
        USING ERRCODE = 'P0001';
    END IF;

    v_def := regexp_replace(v_def, v_old_columns_pattern, v_new_columns, 'i');

    IF v_old_values_fresh_count = 1 THEN
      v_def := regexp_replace(v_def, v_old_values_fresh_pattern, v_new_values_fresh, 'i');
    ELSIF v_old_values_live_count = 1 THEN
      v_def := regexp_replace(v_def, v_old_values_live_pattern, v_new_values_live, 'i');
    ELSE
      RAISE EXCEPTION 'Owner-driver submit VALUES shape was not uniquely identified; refusing rewrite.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Prove the intended physical shape exists exactly once before executing.
    IF regexp_count(v_def, v_new_columns_pattern, 1, 'i') <> 1
       OR (
         regexp_count(v_def, v_new_values_fresh_pattern, 1, 'i')
         + regexp_count(v_def, v_new_values_live_pattern, 1, 'i')
       ) <> 1 THEN
      RAISE EXCEPTION 'Owner-driver submit rewrite did not produce the canonical physical shape; refusing execution.'
        USING ERRCODE = 'P0001';
    END IF;

    EXECUTE v_def;
  END IF;
END
$$;

-- The preserved base remains private; the policy wrapper is still the only
-- callable submit path.
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
