BEGIN;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS invoice_email_subject_template text,
  ADD COLUMN IF NOT EXISTS invoice_email_message_template text;

DROP POLICY IF EXISTS company_settings_insert_operator ON public.company_settings;
DROP POLICY IF EXISTS company_settings_update_operator ON public.company_settings;
DROP POLICY IF EXISTS company_settings_insert_admin ON public.company_settings;
DROP POLICY IF EXISTS company_settings_update_admin ON public.company_settings;

CREATE POLICY company_settings_insert_admin
  ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY company_settings_update_admin
  ON public.company_settings
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

COMMENT ON COLUMN public.company_settings.invoice_email_subject_template IS
  'Company-level default invoice email subject. NULL falls back to the canonical XDrive default.';
COMMENT ON COLUMN public.company_settings.invoice_email_message_template IS
  'Company-level default invoice email message. NULL falls back to the canonical XDrive default.';

COMMIT;
