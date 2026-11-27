DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.decide_awarded_job_cancellation_atomic(uuid,uuid,text,text)'::regprocedure);
  updated text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.loads'::regclass AND attname = 'job_id' AND NOT attisdropped
  ) THEN
    RETURN;
  END IF;
  updated := regexp_replace(definition,
    'UPDATE public\.loads[[:space:]]+SET status = ''cancelled''[[:space:]]+WHERE job_id = v_job\.id;',
    '-- The current loads schema has no job_id link.');
  IF updated = definition THEN
    RAISE EXCEPTION 'Unexpected cancellation definition for legacy loads update';
  END IF;
  EXECUTE updated;
END;
$migration$;
