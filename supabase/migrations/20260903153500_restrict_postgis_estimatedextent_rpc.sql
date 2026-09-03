-- Remove direct PostgREST execution of the PostGIS SECURITY DEFINER
-- ST_EstimatedExtent overloads from public/anon/authenticated roles.
-- XDrive application code does not call these RPCs. Service-role and database
-- owner execution remain available for trusted server/database operations.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'st_estimatedextent'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.signature);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'st_estimatedextent'
      AND p.prosecdef
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'ST_EstimatedExtent remains executable by an exposed application role';
  END IF;
END;
$$;
