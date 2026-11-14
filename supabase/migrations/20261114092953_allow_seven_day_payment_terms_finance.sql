-- Forward-only migration applied to Production on 2026-11-14.
-- Preserve all four approved payment terms without rewriting existing records.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.fn_canonical_xdrive_payment_terms(p_payment_terms text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE v_terms text := lower(btrim(COALESCE(p_payment_terms, '')));
BEGIN
 IF v_terms IN ('pay now','immediate','due on receipt') THEN RETURN 'Pay now'; END IF;
 IF v_terms IN ('7 days','7 day','net 7') THEN RETURN '7 days'; END IF;
 IF v_terms IN ('14 days','14 day','net 14') THEN RETURN '14 days'; END IF;
 IF v_terms IN ('30 days','30 day','net 30') THEN RETURN '30 days'; END IF;
 RAISE EXCEPTION 'Unsupported XDrive payment terms: %. Allowed: Pay now, 7 days, 14 days, 30 days.', COALESCE(NULLIF(btrim(p_payment_terms),''),'<empty>') USING ERRCODE='23514';
END; $$;
CREATE OR REPLACE FUNCTION public.fn_xdrive_payment_due_days(p_payment_terms text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE v_terms text := public.fn_canonical_xdrive_payment_terms(p_payment_terms);
BEGIN RETURN CASE v_terms WHEN 'Pay now' THEN 0 WHEN '7 days' THEN 7 WHEN '14 days' THEN 14 WHEN '30 days' THEN 30 END; END; $$;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_payment_terms_xdrive_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_payment_terms_xdrive_check CHECK (payment_terms IN ('Pay now','7 days','14 days','30 days'));
ALTER TABLE public.company_settings DROP CONSTRAINT IF EXISTS company_settings_payment_terms_xdrive_check;
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_payment_terms_xdrive_check CHECK (default_payment_terms IS NULL OR default_payment_terms IN ('Pay now','7 days','14 days','30 days'));
ALTER TABLE public.job_commercial_agreements DROP CONSTRAINT IF EXISTS job_commercial_agreements_payment_terms_xdrive_check;
ALTER TABLE public.job_commercial_agreements ADD CONSTRAINT job_commercial_agreements_payment_terms_xdrive_check CHECK (payment_terms IN ('Pay now','7 days','14 days','30 days'));
ALTER TABLE public.job_commercial_agreements DROP CONSTRAINT IF EXISTS job_commercial_agreements_payment_due_days_check;
ALTER TABLE public.job_commercial_agreements ADD CONSTRAINT job_commercial_agreements_payment_due_days_check CHECK (payment_due_days IN (0,7,14,30));
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_terms_xdrive_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_terms_xdrive_check CHECK (payment_terms IN ('Pay now','7 days','14 days','30 days'));
COMMIT;