-- Hosted migration-history reconciliation alias.
-- Production recorded prepare_postgis_schema_relocation_bridge at 20260905012522
-- while the canonical repository migration is 20260905003500. Do not rewrite
-- Production migration history. On fresh replay the canonical bridge runs first;
-- this file only verifies its runtime compatibility effect.

BEGIN;

DO $$
DECLARE
  v_postgis_schema name;
  v_sync_config text[];
  v_alert_config text[];
BEGIN
  SELECT n.nspname
  INTO v_postgis_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'postgis';

  IF v_postgis_schema NOT IN ('public', 'extensions') THEN
    RAISE EXCEPTION 'Unexpected PostGIS schema during hosted bridge reconciliation: %.', v_postgis_schema;
  END IF;

  SELECT p.proconfig
  INTO v_sync_config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'fn_sync_driver_location_coordinates'
    AND pg_get_function_identity_arguments(p.oid) = ''
  LIMIT 1;

  SELECT p.proconfig
  INTO v_alert_config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'fn_enqueue_driver_load_alerts_for_job'
    AND pg_get_function_identity_arguments(p.oid) = 'p_job_id uuid, p_recipient_user_id uuid'
  LIMIT 1;

  IF NOT ('search_path=public, extensions, pg_catalog' = ANY (COALESCE(v_sync_config, ARRAY[]::text[])))
     OR NOT ('search_path=public, extensions, pg_catalog' = ANY (COALESCE(v_alert_config, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'PostGIS runtime bridge search_path is not converged.';
  END IF;
END;
$$;

COMMIT;
