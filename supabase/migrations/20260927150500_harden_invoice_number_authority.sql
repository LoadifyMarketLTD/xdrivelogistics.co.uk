BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Use the current JWT role claim helper. Preserve service-role support
-- through the JWT role claim and keep browser/user execution limited to an
-- active Platform Owner or an active member of an active company.
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_jwt_role text := COALESCE(auth.jwt() ->> 'role', '');
  v_prefix text;
  v_count integer;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company id is required.' USING ERRCODE = '22023';
  END IF;

  IF v_jwt_role <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_owner(v_actor)
       AND NOT EXISTS (
         SELECT 1
         FROM public.company_memberships cm
         JOIN public.companies c
           ON c.id = cm.company_id
         JOIN public.profiles p
           ON p.user_id = cm.user_id
         WHERE cm.company_id = p_company_id
           AND cm.user_id = v_actor
           AND cm.status::text = 'active'
           AND c.status::text = 'active'
           AND COALESCE(p.status::text, '') = 'active'
       ) THEN
      RAISE EXCEPTION 'Invoice number access denied.' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = p_company_id
        AND c.status::text = 'active'
    ) THEN
      RAISE EXCEPTION 'Invoice company is not active.' USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));
  v_prefix := 'INV-' || to_char(now(), 'YYYYMM') || '-';

  SELECT count(*) + 1
  INTO v_count
  FROM public.invoices
  WHERE company_id = p_company_id
    AND invoice_number LIKE v_prefix || '%';

  RETURN v_prefix || lpad(v_count::text, 3, '0');
END;
$function$;

REVOKE ALL ON FUNCTION public.next_invoice_number(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid)
TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
