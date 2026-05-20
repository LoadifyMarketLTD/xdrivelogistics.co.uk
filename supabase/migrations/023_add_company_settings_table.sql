CREATE TABLE IF NOT EXISTS public.company_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  legal_name text,
  job_ref_prefix text,
  invoice_prefix text,
  default_vat_rate int DEFAULT 20,
  default_payment_terms text DEFAULT '14 days',
  currency text DEFAULT 'GBP',
  date_format text DEFAULT 'DD/MM/YYYY',
  bank_account_name text,
  bank_sort_code text,
  bank_account_number text,
  paypal_email text,
  notify_email_new_job boolean DEFAULT true,
  notify_email_status_change boolean DEFAULT true,
  notify_email_invoice_paid boolean DEFAULT true,
  notify_email_bid_received boolean DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_company_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_company_settings_updated_at();

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_settings'
      AND policyname = 'company_settings_select_member'
  ) THEN
    CREATE POLICY "company_settings_select_member" ON public.company_settings
      FOR SELECT USING (public.is_company_member(company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_settings'
      AND policyname = 'company_settings_insert_admin'
  ) THEN
    CREATE POLICY "company_settings_insert_admin" ON public.company_settings
      FOR INSERT WITH CHECK (public.is_company_admin(company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_settings'
      AND policyname = 'company_settings_update_admin'
  ) THEN
    CREATE POLICY "company_settings_update_admin" ON public.company_settings
      FOR UPDATE USING (public.is_company_admin(company_id));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
