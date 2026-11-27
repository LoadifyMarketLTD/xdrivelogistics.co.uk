DO $migration$
DECLARE
  function_id regprocedure;
  definition text;
  updated text;
BEGIN
  FOREACH function_id IN ARRAY ARRAY[
    'public.request_awarded_job_cancellation_atomic(uuid,uuid,text)'::regprocedure,
    'public.decide_awarded_job_cancellation_atomic(uuid,uuid,text,text)'::regprocedure
  ] LOOP
    definition := pg_get_functiondef(function_id);
    updated := regexp_replace(
      definition,
      '(INSERT INTO public\.owner_audit_log\([[:space:]]*actor_user_id,)([[:space:]]*target_company_id,[^;]+?VALUES[[:space:]]*\([[:space:]]*p_actor_user_id,)',
      '\1 target_type, target_id,\2 ''job'', v_job.id,'
    );
    IF updated = definition THEN
      RAISE EXCEPTION 'Unexpected cancellation audit definition: %', function_id;
    END IF;
    EXECUTE updated;
  END LOOP;
END;
$migration$;
