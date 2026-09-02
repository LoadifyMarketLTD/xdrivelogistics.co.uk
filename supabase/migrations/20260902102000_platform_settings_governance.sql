BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

DO $preflight$
BEGIN
  IF to_regclass('public.platform_feature_flags') IS NULL THEN
    RAISE EXCEPTION 'public.platform_feature_flags must exist before applying Platform settings governance.' USING ERRCODE = '23514';
  END IF;
  IF to_regclass('public.platform_settings') IS NULL THEN
    RAISE EXCEPTION 'public.platform_settings must exist before applying Platform settings governance.' USING ERRCODE = '23514';
  END IF;
  IF to_regclass('public.owner_audit_log') IS NULL THEN
    RAISE EXCEPTION 'public.owner_audit_log must exist before applying Platform settings governance.' USING ERRCODE = '23514';
  END IF;
  IF to_regprocedure('public.assert_platform_owner_actor(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.assert_platform_owner_actor(uuid) must exist before applying Platform settings governance.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_feature_flags'
      AND column_name = 'is_enabled' AND data_type = 'boolean'
  ) THEN
    RAISE EXCEPTION 'platform_feature_flags.is_enabled boolean is required.' USING ERRCODE = '23514';
  END IF;
END;
$preflight$;

-- Close direct browser/tenant writes. Reads remain governed by existing RLS and
-- internal database consumers are unaffected. All Super Admin mutations go
-- through the service-role-only audited RPC below.
DROP POLICY IF EXISTS platform_settings_write_owner ON public.platform_settings;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.platform_settings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.platform_feature_flags FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_update_platform_configuration(
  p_actor_user_id uuid,
  p_section text,
  p_changes jsonb,
  p_reason text
)
RETURNS TABLE (section text, updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_section text := lower(btrim(COALESCE(p_section, '')));
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_change jsonb;
  v_key text;
  v_label text;
  v_description text;
  v_category text;
  v_value text;
  v_value_type text;
  v_enabled boolean;
  v_old_enabled boolean;
  v_old_value text;
  v_exists boolean;
  v_updated integer := 0;
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  IF v_section NOT IN ('feature-flags', 'global') THEN
    RAISE EXCEPTION 'Unsupported Platform configuration section: %', v_section USING ERRCODE = '23514';
  END IF;
  IF char_length(v_reason) < 5 THEN
    RAISE EXCEPTION 'A Platform configuration change reason of at least 5 characters is required.' USING ERRCODE = '23514';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'array'
     OR jsonb_array_length(p_changes) = 0 OR jsonb_array_length(p_changes) > 100 THEN
    RAISE EXCEPTION 'Platform configuration changes must be a non-empty JSON array of at most 100 entries.' USING ERRCODE = '23514';
  END IF;

  FOR v_change IN SELECT value FROM jsonb_array_elements(p_changes)
  LOOP
    v_key := btrim(COALESCE(v_change->>'key', ''));
    v_label := btrim(COALESCE(v_change->>'label', ''));
    v_category := btrim(COALESCE(v_change->>'category', ''));
    IF v_key = '' OR v_label = '' OR v_category = '' THEN
      RAISE EXCEPTION 'Each Platform configuration change requires key, label and category.' USING ERRCODE = '23514';
    END IF;

    IF v_section = 'feature-flags' THEN
      IF NOT (v_change ? 'enabled') OR lower(COALESCE(v_change->>'enabled', '')) NOT IN ('true', 'false') THEN
        RAISE EXCEPTION 'Feature flag % requires a boolean enabled value.', v_key USING ERRCODE = '23514';
      END IF;
      v_description := COALESCE(v_change->>'description', '');
      v_enabled := (v_change->>'enabled')::boolean;
      v_exists := false;
      v_old_enabled := NULL;

      SELECT true, flag.is_enabled INTO v_exists, v_old_enabled
      FROM public.platform_feature_flags AS flag
      WHERE flag.key = v_key FOR UPDATE;

      IF COALESCE(v_exists, false) AND v_old_enabled IS NOT DISTINCT FROM v_enabled THEN
        CONTINUE;
      END IF;

      INSERT INTO public.platform_feature_flags (key, label, description, category, is_enabled, updated_by)
      VALUES (v_key, v_label, v_description, v_category, v_enabled, p_actor_user_id)
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        is_enabled = EXCLUDED.is_enabled,
        updated_by = EXCLUDED.updated_by;

      INSERT INTO public.owner_audit_log (
        actor_user_id, target_type, target_id, target_name, target_company_id,
        action_type, old_status, new_status, reason, metadata, created_at
      ) VALUES (
        p_actor_user_id, 'platform_feature_flag', NULL, v_key, NULL,
        'platform_feature_flag_updated',
        CASE WHEN v_old_enabled IS NULL THEN NULL WHEN v_old_enabled THEN 'enabled' ELSE 'disabled' END,
        CASE WHEN v_enabled THEN 'enabled' ELSE 'disabled' END,
        v_reason,
        jsonb_build_object('key', v_key, 'previous_enabled', v_old_enabled, 'enabled', v_enabled, 'category', v_category),
        clock_timestamp()
      );
      v_updated := v_updated + 1;
      CONTINUE;
    END IF;

    v_value := COALESCE(v_change->>'value', '');
    v_value_type := lower(btrim(COALESCE(v_change->>'value_type', '')));
    IF v_value_type NOT IN ('text', 'number', 'boolean') THEN
      RAISE EXCEPTION 'Platform setting % has an invalid value_type.', v_key USING ERRCODE = '23514';
    END IF;
    IF v_value_type = 'number' THEN
      BEGIN
        PERFORM v_value::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Platform setting % must contain a numeric value.', v_key USING ERRCODE = '23514';
      END;
    ELSIF v_value_type = 'boolean' AND lower(btrim(v_value)) NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Platform setting % must contain true or false.', v_key USING ERRCODE = '23514';
    END IF;

    v_exists := false;
    v_old_value := NULL;
    SELECT true, setting.value INTO v_exists, v_old_value
    FROM public.platform_settings AS setting
    WHERE setting.key = v_key FOR UPDATE;

    IF COALESCE(v_exists, false) AND v_old_value IS NOT DISTINCT FROM v_value THEN
      CONTINUE;
    END IF;

    INSERT INTO public.platform_settings (key, label, value, value_type, category, updated_by)
    VALUES (v_key, v_label, v_value, v_value_type, v_category, p_actor_user_id)
    ON CONFLICT (key) DO UPDATE SET
      label = EXCLUDED.label,
      value = EXCLUDED.value,
      value_type = EXCLUDED.value_type,
      category = EXCLUDED.category,
      updated_by = EXCLUDED.updated_by;

    INSERT INTO public.owner_audit_log (
      actor_user_id, target_type, target_id, target_name, target_company_id,
      action_type, old_status, new_status, reason, metadata, created_at
    ) VALUES (
      p_actor_user_id, 'platform_setting', NULL, v_key, NULL,
      'platform_setting_updated', v_old_value, v_value, v_reason,
      jsonb_build_object('key', v_key, 'previous_value', v_old_value, 'value', v_value, 'value_type', v_value_type, 'category', v_category),
      clock_timestamp()
    );
    v_updated := v_updated + 1;
  END LOOP;

  RETURN QUERY SELECT v_section, v_updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_update_platform_configuration(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_update_platform_configuration(uuid, text, jsonb, text) TO service_role;

COMMENT ON FUNCTION public.owner_update_platform_configuration(uuid, text, jsonb, text)
IS 'Atomically applies Platform feature-flag/global-setting changes through active Platform Owner authority and writes one durable audit row per changed key.';

COMMIT;

NOTIFY pgrst, 'reload schema';
