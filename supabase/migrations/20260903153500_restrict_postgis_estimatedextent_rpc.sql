-- Remove direct PostgREST execution of the PostGIS SECURITY DEFINER
-- ST_EstimatedExtent overloads from public/anon/authenticated roles.
-- XDrive application code does not call these RPCs. Service-role and database
-- owner execution remain available for trusted server/database operations.
--
-- Supabase/PostGIS installs these three overloads in public. Use explicit,
-- schema-qualified signatures so privilege changes cannot resolve against an
-- unintended search_path object.

DO $$
BEGIN
  IF to_regprocedure('public.st_estimatedextent(text,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text,text) FROM PUBLIC, anon, authenticated;
  END IF;

  IF to_regprocedure('public.st_estimatedextent(text,text,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text,text,text) FROM PUBLIC, anon, authenticated;
  END IF;

  IF to_regprocedure('public.st_estimatedextent(text,text,text,boolean)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text,text,text,boolean) FROM PUBLIC, anon, authenticated;
  END IF;
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
