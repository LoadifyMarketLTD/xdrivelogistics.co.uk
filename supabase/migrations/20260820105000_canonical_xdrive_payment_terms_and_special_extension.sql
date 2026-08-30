-- XDrive PreLive finance contract:
--   * base payment terms are Pay now / 14 days / 30 days only;
--   * no 45-day or 60-day standard terms exist;
--   * one exceptional +15 day invoice extension may be granted through the
--     finance-authorised server path, with actor/time/reason audit fields;
--   * the base contractual term remains unchanged when an extension is granted.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Hosted production contains this nullable posting-company attribution column
-- and index from historical drift. Reconstruct that observed structural contract
-- before this migration first references it. Do not backfill data or invent an FK.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS posted_by_company_id uuid;

CREATE INDEX IF NOT EXISTS idx_jobs_posted_by_company
  ON public.jobs (posted_by_company_id);

CREATE OR REPLACE FUNCTION public.fn_canonical_xdrive_payment_terms(p_payment_terms text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_terms text := lower(btrim(COALESCE(p_payment_terms, '')));
BEGIN
  IF v_terms IN ('pay now', 'immediate', 'due on receipt') THEN
    RETURN 'Pay now';
  END IF;

  IF v_terms IN ('14 days', '14 day', 'net 14') THEN
    RETURN '14 days';
  END IF;

  IF v_terms IN ('30 days', '30 day', 'net 30') THEN
    RETURN '30 days';
  END IF;

  RAISE EXCEPTION 'Unsupported XDrive payment terms: %. Allowed base terms are Pay now, 14 days, or 30 days.',
    COALESCE(NULLIF(btrim(p_payment_terms, ''), '<empty>'), '<empty>')
    USING ERRCODE = '23514';
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_xdrive_payment_due_days(p_payment_terms text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_terms text := public.fn_canonical_xdrive_payment_terms(p_payment_terms);
BEGIN
  RETURN CASE v_terms
    WHEN 'Pay now' THEN 0
    WHEN '14 days' THEN 14
    WHEN '30 days' THEN 30
  END;
END;
$$;

-- Keep the existing public helper name, but make it obey the XDrive financial
-- contract instead of accepting arbitrary numbers embedded in free text.
CREATE OR REPLACE FUNCTION public.fn_parse_payment_due_days(p_payment_terms text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.fn_xdrive_payment_due_days(p_payment_terms);
$$;

-- Canonicalise only known historical aliases. Unknown historical values fail
-- the migration rather than being silently rewritten to a different contract.
-- Reconcile historical NULL job terms from authoritative existing records:
-- immutable commercial snapshots first, then the posting company's settings.
WITH canonical_job_payment_terms AS (
  SELECT
    j.id AS job_id,
    COALESCE(a.payment_terms, cs.default_payment_terms) AS payment_terms
  FROM public.jobs j
  LEFT JOIN public.job_commercial_agreements a
    ON a.job_id = j.id
  LEFT JOIN public.company_settings cs
    ON cs.company_id = COALESCE(j.posted_by_company_id, j.company_id)
  WHERE j.payment_terms IS NULL
)
UPDATE public.jobs j
SET payment_terms = source.payment_terms
FROM canonical_job_payment_terms source
WHERE j.id = source.job_id
  AND source.payment_terms IN ('Pay now', '14 days', '30 days');

UPDATE public.jobs
SET payment_terms = public.fn_canonical_xdrive_payment_terms(payment_terms)
WHERE lower(btrim(payment_terms)) IN (
  'pay now', 'immediate', 'due on receipt',
  '14 days', '14 day', 'net 14',
  '30 days', '30 day', 'net 30'
);

UPDATE public.company_settings
SET default_payment_terms = public.fn_canonical_xdrive_payment_terms(default_payment_terms)
WHERE default_payment_terms IS NOT NULL
  AND lower(btrim(default_payment_terms)) IN (
    'pay now', 'immediate', 'due on receipt',
    '14 days', '14 day', 'net 14',
    '30 days', '30 day', 'net 30'
  );

-- Commercial agreements are immutable ledger snapshots and must never be
-- rewritten by canonicalisation. The fail-closed validation below requires
-- every existing snapshot to already satisfy the canonical payment contract.

UPDATE public.invoices
SET payment_terms = public.fn_canonical_xdrive_payment_terms(payment_terms)
WHERE lower(btrim(payment_terms)) IN (
  'pay now', 'immediate', 'due on receipt',
  '14 days', '14 day', 'net 14',
  '30 days', '30 day', 'net 30'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.jobs
    WHERE payment_terms IS NULL
       OR payment_terms NOT IN ('Pay now', '14 days', '30 days')
  ) THEN
    RAISE EXCEPTION 'PreLive payment-term migration blocked: jobs contains unsupported payment terms.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.company_settings
    WHERE default_payment_terms IS NOT NULL
      AND default_payment_terms NOT IN ('Pay now', '14 days', '30 days')
  ) THEN
    RAISE EXCEPTION 'PreLive payment-term migration blocked: company_settings contains unsupported payment terms.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.job_commercial_agreements
    WHERE payment_terms NOT IN ('Pay now', '14 days', '30 days')
       OR payment_due_days IS DISTINCT FROM public.fn_xdrive_payment_due_days(payment_terms)
  ) THEN
    RAISE EXCEPTION 'PreLive payment-term migration blocked: a commercial agreement contains unsupported or inconsistent payment terms.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE payment_terms NOT IN ('Pay now', '14 days', '30 days')
  ) THEN
    RAISE EXCEPTION 'PreLive payment-term migration blocked: invoices contains unsupported payment terms.';
  END IF;
END;
$$;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_payment_terms_xdrive_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_payment_terms_xdrive_check
  CHECK (payment_terms IN ('Pay now', '14 days', '30 days'));

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_payment_terms_xdrive_check;
ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_payment_terms_xdrive_check
  CHECK (default_payment_terms IS NULL OR default_payment_terms IN ('Pay now', '14 days', '30 days'));

ALTER TABLE public.job_commercial_agreements
  DROP CONSTRAINT IF EXISTS job_commercial_agreements_payment_terms_xdrive_check;
ALTER TABLE public.job_commercial_agreements
  ADD CONSTRAINT job_commercial_agreements_payment_terms_xdrive_check
  CHECK (payment_terms IN ('Pay now', '14 days', '30 days'));

ALTER TABLE public.job_commercial_agreements
  DROP CONSTRAINT IF EXISTS job_commercial_agreements_payment_due_days_check;
ALTER TABLE public.job_commercial_agreements
  ADD CONSTRAINT job_commercial_agreements_payment_due_days_check
  CHECK (payment_due_days IN (0, 14, 30));

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_terms_xdrive_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_terms_xdrive_check
  CHECK (payment_terms IN ('Pay now', '14 days', '30 days'));

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_extension_days smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_extension_reason text,
  ADD COLUMN IF NOT EXISTS payment_extended_at timestamptz,
  -- Deliberately no FK to auth.users: this is immutable audit identity and must
  -- survive later user deletion/anonymisation without corrupting the extension.
  ADD COLUMN IF NOT EXISTS payment_extended_by uuid;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_extension_days_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_extension_days_check
  CHECK (payment_extension_days IN (0, 15));

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_extension_metadata_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_extension_metadata_check
  CHECK (
    (
      payment_extension_days = 0
      AND payment_extension_reason IS NULL
      AND payment_extended_at IS NULL
      AND payment_extended_by IS NULL
    )
    OR
    (
      payment_extension_days = 15
      AND length(btrim(COALESCE(payment_extension_reason, ''))) >= 10
      AND payment_extended_at IS NOT NULL
      AND payment_extended_by IS NOT NULL
    )
  );

-- Runs after the historical commercial snapshot trigger (PostgreSQL trigger
-- names fire alphabetically) and refuses any caller-supplied due-day mismatch.
CREATE OR REPLACE FUNCTION public.fn_guard_xdrive_commercial_payment_terms()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_terms text;
  v_due_days integer;
BEGIN
  v_terms := public.fn_canonical_xdrive_payment_terms(NEW.payment_terms);
  v_due_days := public.fn_xdrive_payment_due_days(v_terms);

  IF NEW.payment_due_days IS NOT NULL AND NEW.payment_due_days <> v_due_days THEN
    RAISE EXCEPTION 'Commercial agreement payment_due_days must match its XDrive base payment term.'
      USING ERRCODE = '23514';
  END IF;

  NEW.payment_terms := v_terms;
  NEW.payment_due_days := v_due_days;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_trg_guard_xdrive_commercial_payment_terms
  ON public.job_commercial_agreements;
CREATE TRIGGER zz_trg_guard_xdrive_commercial_payment_terms
BEFORE INSERT OR UPDATE OF payment_terms, payment_due_days
ON public.job_commercial_agreements
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_xdrive_commercial_payment_terms();

CREATE OR REPLACE FUNCTION public.fn_guard_xdrive_invoice_payment_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_terms text;
  v_base_days integer;
  v_extension smallint := COALESCE(NEW.payment_extension_days, 0);
  v_expected_due_date date;
  v_trusted_finance_path boolean := current_user IN ('postgres', 'service_role');
BEGIN
  v_terms := public.fn_canonical_xdrive_payment_terms(NEW.payment_terms);
  v_base_days := public.fn_xdrive_payment_due_days(v_terms);

  IF v_extension NOT IN (0, 15) THEN
    RAISE EXCEPTION 'XDrive payment extension must be 0 or 15 days.' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' AND v_extension <> 0 THEN
    RAISE EXCEPTION 'A special payment extension cannot be created together with a new invoice.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.payment_extension_days = 15 AND v_extension <> 15 THEN
      RAISE EXCEPTION 'An approved payment extension is an audit event and cannot be removed.'
        USING ERRCODE = '23514';
    END IF;

    IF (
      NEW.payment_extension_days IS DISTINCT FROM OLD.payment_extension_days
      OR NEW.payment_extension_reason IS DISTINCT FROM OLD.payment_extension_reason
      OR NEW.payment_extended_at IS DISTINCT FROM OLD.payment_extended_at
      OR NEW.payment_extended_by IS DISTINCT FROM OLD.payment_extended_by
    ) AND NOT v_trusted_finance_path THEN
      RAISE EXCEPTION 'Special payment extensions require the controlled finance approval path.'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.payment_extension_days = 15
       AND (
         NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
         OR NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
       ) THEN
      RAISE EXCEPTION 'Base invoice terms cannot be changed after a special payment extension is granted.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_extension = 0 THEN
    IF NEW.payment_extension_reason IS NOT NULL
       OR NEW.payment_extended_at IS NOT NULL
       OR NEW.payment_extended_by IS NOT NULL THEN
      RAISE EXCEPTION 'Payment extension audit fields require the +15 day extension.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF length(btrim(COALESCE(NEW.payment_extension_reason, ''))) < 10
       OR NEW.payment_extended_at IS NULL
       OR NEW.payment_extended_by IS NULL THEN
      RAISE EXCEPTION 'A +15 day payment extension requires a reason, actor and timestamp.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.payment_terms := v_terms;
  v_expected_due_date := NEW.invoice_date + (v_base_days + v_extension);

  IF TG_OP = 'INSERT' THEN
    NEW.due_date := v_expected_due_date;
  ELSIF NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
     OR NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
     OR NEW.payment_extension_days IS DISTINCT FROM OLD.payment_extension_days THEN
    NEW.due_date := v_expected_due_date;
  ELSIF NEW.due_date IS DISTINCT FROM v_expected_due_date THEN
    RAISE EXCEPTION 'Invoice due date must equal the XDrive base term plus any approved +15 day extension.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_xdrive_invoice_payment_contract ON public.invoices;
CREATE TRIGGER trg_guard_xdrive_invoice_payment_contract
BEFORE INSERT OR UPDATE OF
  invoice_date,
  due_date,
  payment_terms,
  payment_extension_days,
  payment_extension_reason,
  payment_extended_at,
  payment_extended_by
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_xdrive_invoice_payment_contract();

CREATE OR REPLACE FUNCTION public.extend_invoice_due_date_special(
  p_invoice_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
RETURNS TABLE (
  invoice_id uuid,
  payment_terms text,
  payment_extension_days smallint,
  due_date date,
  payment_extended_at timestamptz,
  payment_extended_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_role text;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Finance actor is required.' USING ERRCODE = '42501';
  END IF;

  IF length(v_reason) < 10 THEN
    RAISE EXCEPTION 'A specific reason of at least 10 characters is required for the special payment extension.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT cm.role_in_company::text
  INTO v_role
  FROM public.company_memberships cm
  WHERE cm.company_id = v_invoice.company_id
    AND cm.user_id = p_actor_user_id
    AND COALESCE(cm.status::text, '') = 'active'
  LIMIT 1;

  IF COALESCE(v_role, '') NOT IN ('owner', 'admin', 'finance') THEN
    RAISE EXCEPTION 'Owner, admin or finance role is required to grant a payment extension.'
      USING ERRCODE = '42501';
  END IF;

  IF lower(COALESCE(v_invoice.status::text, '')) IN ('paid', 'cancelled')
     OR lower(COALESCE(v_invoice.payment_status::text, '')) = 'paid' THEN
    RAISE EXCEPTION 'Paid or cancelled invoices cannot receive a payment extension.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(v_invoice.payment_extension_days, 0) = 15 THEN
    RAISE EXCEPTION 'This invoice already has the maximum +15 day payment extension.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.invoices i
  SET payment_extension_days = 15,
      payment_extension_reason = v_reason,
      payment_extended_at = now(),
      payment_extended_by = p_actor_user_id,
      due_date = i.invoice_date
        + (public.fn_xdrive_payment_due_days(i.payment_terms) + 15),
      updated_at = now()
  WHERE i.id = p_invoice_id;

  RETURN QUERY
  SELECT
    i.id,
    i.payment_terms,
    i.payment_extension_days,
    i.due_date,
    i.payment_extended_at,
    i.payment_extended_by
  FROM public.invoices i
  WHERE i.id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.extend_invoice_due_date_special(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extend_invoice_due_date_special(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.extend_invoice_due_date_special(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.extend_invoice_due_date_special(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.extend_invoice_due_date_special(uuid, uuid, text) IS
  'Service-only finance authority for the one permitted XDrive payment exception: +15 days, once, with active owner/admin/finance actor and an audit reason.';

NOTIFY pgrst, 'reload schema';

COMMIT;
