DO $pickup_optional$
DECLARE
  original_sql text;
  revised_sql text;
  block_start integer;
  block_end integer;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO original_sql
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'driver_update_job_status_atomic';

  IF original_sql IS NULL OR md5(original_sql) <> '401e4a7479683a79dd3ab8fa6b1aac82' THEN
    RAISE EXCEPTION 'Production RPC changed since inspection; cancel migration';
  END IF;

  block_start := position('IF v_next_status = ''loaded'' AND v_effective_collection_photo IS NULL THEN' IN original_sql);
  block_end := position('IF v_next_status = ''completed'' THEN' IN original_sql);
  IF block_start = 0 OR block_end <= block_start THEN
    RAISE EXCEPTION 'Expected pickup photo guard not found';
  END IF;

  IF position('A loading photo is required before marking the job loaded.' IN substring(original_sql FROM block_start FOR block_end-block_start)) = 0 THEN
    RAISE EXCEPTION 'Unexpected pickup photo block; cancel migration';
  END IF;

  revised_sql := left(original_sql, block_start-1)
    || '-- Pickup photo is optional; delivery POD and driver authorization unchanged.' || E'\n  '
    || substring(original_sql FROM block_end);
  EXECUTE revised_sql;
END;
$pickup_optional$;