BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- These SECURITY DEFINER wrappers are consumed by RLS/storage policies.
-- Keep their existing authorization semantics, but lock their search path and
-- delegate to the already hardened canonical membership helpers.

CREATE OR REPLACE FUNCTION public.can_admin_manage_job(jid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = jid
      AND public.is_company_admin(j.company_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_non_driver_access_job(jid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = jid
      AND public.is_company_non_driver(j.company_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_operator_access_job(jid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = jid
      AND public.is_company_operator(j.company_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_read_invoice_storage_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoice_documents d
    WHERE d.file_url = p_object_name
      AND public.is_company_member(d.company_id)
  );
$function$;

REVOKE ALL ON FUNCTION public.can_admin_manage_job(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_non_driver_access_job(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_operator_access_job(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_invoice_storage_object(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_admin_manage_job(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_non_driver_access_job(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_operator_access_job(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_invoice_storage_object(text) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
