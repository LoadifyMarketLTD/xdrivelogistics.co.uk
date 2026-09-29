BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

REVOKE ALL ON TABLE public.company_specialist_capabilities FROM anon;
REVOKE ALL ON TABLE public.company_member_blocks FROM anon;
REVOKE ALL ON TABLE public.company_settings FROM anon;

REVOKE ALL ON TABLE public.company_specialist_capabilities FROM authenticated;
REVOKE ALL ON TABLE public.company_member_blocks FROM authenticated;
REVOKE ALL ON TABLE public.company_settings FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.company_specialist_capabilities
  TO authenticated;

GRANT SELECT, INSERT, DELETE
  ON TABLE public.company_member_blocks
  TO authenticated;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.company_settings
  TO authenticated;

DROP POLICY IF EXISTS company_settings_select_member ON public.company_settings;
CREATE POLICY company_settings_select_member
  ON public.company_settings
  FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

DO $verify$
BEGIN
  IF has_table_privilege('anon', 'public.company_specialist_capabilities', 'SELECT')
     OR has_table_privilege('anon', 'public.company_member_blocks', 'SELECT')
     OR has_table_privilege('anon', 'public.company_settings', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous access remains on CX operational settings tables.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.company_specialist_capabilities', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.company_member_blocks', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.company_settings', 'SELECT') THEN
    RAISE EXCEPTION 'Authenticated least-privilege grants were not established.'
      USING ERRCODE = '42501';
  END IF;
END;
$verify$;

COMMIT;
