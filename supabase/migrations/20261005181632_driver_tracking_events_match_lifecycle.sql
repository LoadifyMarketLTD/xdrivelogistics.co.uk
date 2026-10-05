BEGIN;

DO $$
DECLARE
  v_def text;
  v_original text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='driver_update_job_status_atomic'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'driver_update_job_status_atomic not found';
  END IF;

  v_original := v_def;
  v_def := replace(v_def, $old$WHEN 'accepted' THEN 'note'$old$, $new$WHEN 'accepted' THEN 'accepted'$new$);
  v_def := replace(v_def, $old$WHEN 'completed' THEN 'note'$old$, $new$WHEN 'completed' THEN 'completed'$new$);

  IF v_def = v_original
     OR position($needle$WHEN 'accepted' THEN 'accepted'$needle$ in v_def)=0
     OR position($needle$WHEN 'completed' THEN 'completed'$needle$ in v_def)=0 THEN
    RAISE EXCEPTION 'driver tracking event mapping patch failed';
  END IF;

  EXECUTE v_def;
END
$$;

UPDATE public.job_tracking_events
SET event_type='accepted'
WHERE event_type='note'
  AND message='Driver updated job status to accepted.'
  AND coalesce(meta->>'source','')='driver_atomic_rpc';

UPDATE public.job_tracking_events
SET event_type='completed'
WHERE event_type='note'
  AND message='Driver updated job status to completed.'
  AND coalesce(meta->>'source','')='driver_atomic_rpc';

COMMIT;

NOTIFY pgrst, 'reload schema';
