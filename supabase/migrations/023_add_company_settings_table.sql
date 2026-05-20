-- Migration 023: Add company_settings table for persistent admin settings
-- One row per company, stores JSON settings blob.

BEGIN;

CREATE TABLE IF NOT EXISTS public.company_settings (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  uuid        NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  settings_data jsonb     NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookups by company
CREATE INDEX IF NOT EXISTS company_settings_company_id_idx ON public.company_settings (company_id);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION public.set_company_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_company_settings_updated_at();

-- RLS: only company members can read/write their own company's settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_settings_select" ON public.company_settings;
CREATE POLICY "company_settings_select" ON public.company_settings
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "company_settings_upsert" ON public.company_settings;
CREATE POLICY "company_settings_upsert" ON public.company_settings
  FOR ALL USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

COMMIT;
