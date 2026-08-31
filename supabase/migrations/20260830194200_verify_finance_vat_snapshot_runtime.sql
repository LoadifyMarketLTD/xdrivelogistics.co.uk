BEGIN;

-- P0-09 runtime proof. Build a complete synthetic finance chain so zero-data
-- previews exercise the same VAT/snapshot/immutability boundaries as hosted
-- production. The fixture is deliberately rolled back inside a subtransaction.
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_supplier_company_id uuid := gen_random_uuid();
  v_buyer_company_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_bid_id uuid := gen_random_uuid();
  v_agreement_id uuid := gen_random_uuid();
  v_invoice_id uuid := gen_random_uuid();
  v_legacy_invoice_id uuid := gen_random_uuid();
  v_original_net numeric;
  v_original_amount numeric;
  v_original_subtotal numeric;
  v_original_total numeric;
  v_original_gross numeric;
  v_probe_subtotal numeric;
  v_probe_total numeric;
  v_probe_gross numeric;
  v_rejected boolean := false;
  v_bad_settings integer;
  v_bad_agreements integer;
  v_bad_invoices integer;
BEGIN
  BEGIN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'p0-09-' || v_user_id::text || '@example.invalid',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"P0-09 Synthetic Finance"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO public.companies (id, name, status, created_by)
    VALUES
      (v_supplier_company_id, 'P0-09 Synthetic Supplier', 'active', v_user_id),
      (v_buyer_company_id, 'P0-09 Synthetic Buyer', 'active', v_user_id);

    INSERT INTO public.company_settings (
      company_id,
      default_vat_rate,
      default_vat_treatment,
      default_payment_terms,
      updated_by
    ) VALUES (
      v_supplier_company_id,
      0,
      'not_registered',
      '14 days',
      v_user_id
    )
    ON CONFLICT (company_id) DO UPDATE
    SET default_vat_rate = EXCLUDED.default_vat_rate,
        default_vat_treatment = EXCLUDED.default_vat_treatment,
        default_payment_terms = EXCLUDED.default_payment_terms,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

    INSERT INTO public.jobs (
      id,
      company_id,
      created_by,
      status,
      current_status,
      is_test,
      payment_terms,
      pod_required
    ) VALUES (
      v_job_id,
      v_buyer_company_id,
      v_user_id,
      'draft',
      'draft',
      true,
      '14 days',
      true
    );

    -- The bid row exists only to satisfy the agreement FK. Disable the two
    -- unrelated quote-authority INSERT guards for fixture setup; all FK/check
    -- constraints and the price synchronization trigger remain active.
    EXECUTE 'ALTER TABLE public.job_bids DISABLE TRIGGER trg_guard_driver_quote_mutation';
    EXECUTE 'ALTER TABLE public.job_bids DISABLE TRIGGER trg_job_bids_compliance_guard';

    INSERT INTO public.job_bids (
      id,
      job_id,
      bidder_user_id,
      company_id,
      amount,
      status
    ) VALUES (
      v_bid_id,
      v_job_id,
      v_user_id,
      v_supplier_company_id,
      100.00,
      'submitted'
    );

    EXECUTE 'ALTER TABLE public.job_bids ENABLE TRIGGER trg_guard_driver_quote_mutation';
    EXECUTE 'ALTER TABLE public.job_bids ENABLE TRIGGER trg_job_bids_compliance_guard';

    INSERT INTO public.job_commercial_agreements (
      id,
      job_id,
      bid_id,
      buyer_company_id,
      supplier_company_id,
      agreed_amount,
      currency,
      vat_rate,
      vat_amount,
      agreed_gross_amount,
      payment_terms,
      payment_due_days,
      pod_required,
      agreement_status,
      accepted_at,
      vat_treatment,
      created_by
    ) VALUES (
      v_agreement_id,
      v_job_id,
      v_bid_id,
      v_buyer_company_id,
      v_supplier_company_id,
      100.00,
      'GBP',
      0,
      0,
      100.00,
      '14 days',
      14,
      true,
      'accepted',
      now(),
      'not_registered',
      v_user_id
    );

    INSERT INTO public.invoices (
      id,
      company_id,
      created_by,
      invoice_number,
      job_ref,
      job_id,
      due_date,
      status,
      client_name,
      net_amount,
      vat_treatment,
      vat_rate,
      vat_amount,
      amount,
      currency,
      payment_terms,
      invoice_origin,
      commercial_agreement_id,
      buyer_company_id,
      supplier_company_id,
      invoice_generation_idempotency_key
    ) VALUES (
      v_invoice_id,
      v_supplier_company_id,
      v_user_id,
      'P0-09-SYNTHETIC',
      'P0-09-JOB',
      v_job_id,
      current_date + 14,
      'Pending'::public.invoice_status,
      'P0-09 Synthetic Buyer',
      100.00,
      'not_registered',
      0,
      0,
      100.00,
      'GBP',
      '14 days',
      'marketplace',
      v_agreement_id,
      v_buyer_company_id,
      v_supplier_company_id,
      'p0-09-valid-' || v_invoice_id::text
    );

    SELECT net_amount, amount, subtotal, total, agreed_gross_amount
    INTO v_original_net, v_original_amount, v_original_subtotal, v_original_total, v_original_gross
    FROM public.invoices
    WHERE id = v_invoice_id;

    IF v_original_net IS DISTINCT FROM 100.00
       OR v_original_amount IS DISTINCT FROM 100.00
       OR v_original_subtotal IS DISTINCT FROM 100.00
       OR v_original_total IS DISTINCT FROM 100.00
       OR v_original_gross IS DISTINCT FROM 100.00 THEN
      RAISE EXCEPTION 'Synthetic invoice was not canonicalized to a zero-VAT 100.00 snapshot.';
    END IF;

    -- Direct writes to duplicate money fields must be canonicalized before the
    -- snapshot validator sees the row. Force a mutation, prove normalization,
    -- and deliberately raise/catch to roll the probe back.
    BEGIN
      UPDATE public.invoices
      SET subtotal = 999,
          total = 998,
          agreed_gross_amount = 997
      WHERE id = v_invoice_id;

      SELECT subtotal, total, agreed_gross_amount
      INTO v_probe_subtotal, v_probe_total, v_probe_gross
      FROM public.invoices
      WHERE id = v_invoice_id;

      IF abs(v_probe_subtotal - v_original_net) > 0.01
         OR abs(v_probe_total - v_original_amount) > 0.01
         OR abs(v_probe_gross - v_original_amount) > 0.01 THEN
        RAISE EXCEPTION 'Invoice duplicate-money synchronization probe failed.';
      END IF;

      RAISE EXCEPTION 'rollback finance sync probe' USING ERRCODE = 'P0001';
    EXCEPTION
      WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'rollback finance sync probe' THEN
          RAISE;
        END IF;
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = v_invoice_id
        AND i.net_amount IS NOT DISTINCT FROM v_original_net
        AND i.amount IS NOT DISTINCT FROM v_original_amount
        AND i.subtotal IS NOT DISTINCT FROM v_original_subtotal
        AND i.total IS NOT DISTINCT FROM v_original_total
        AND i.agreed_gross_amount IS NOT DISTINCT FROM v_original_gross
    ) THEN
      RAISE EXCEPTION 'Finance synchronization probe did not roll back cleanly.';
    END IF;

    -- A non-VAT-registered issuer cannot be changed to a taxable treatment.
    v_rejected := false;
    BEGIN
      UPDATE public.invoices
      SET vat_treatment = 'standard'
      WHERE id = v_invoice_id;
    EXCEPTION
      WHEN SQLSTATE '23514' THEN
        v_rejected := true;
    END;

    IF NOT v_rejected THEN
      RAISE EXCEPTION 'Non-VAT issuer accepted a taxable invoice treatment.';
    END IF;

    -- The agreement repair window is closed again; the ledger must be immutable.
    v_rejected := false;
    BEGIN
      UPDATE public.job_commercial_agreements
      SET vat_rate = 20
      WHERE id = v_agreement_id;
    EXCEPTION
      WHEN SQLSTATE '23514' THEN
        v_rejected := true;
    END;

    IF NOT v_rejected THEN
      RAISE EXCEPTION 'Commercial agreement immutability was not restored.';
    END IF;

    -- Build an intentionally invalid legacy zero-value invoice without running
    -- current write guards, then prove the P0-09 preservation rule can classify
    -- it as void audit history. Only the target finance triggers are bypassed
    -- for fixture construction; constraints/FKs remain enforced.
    EXECUTE 'ALTER TABLE public.invoices DISABLE TRIGGER trg_guard_xdrive_invoice_vat_contract';
    EXECUTE 'ALTER TABLE public.invoices DISABLE TRIGGER trg_validate_invoice_snapshot_integrity';

    INSERT INTO public.invoices (
      id,
      company_id,
      created_by,
      invoice_number,
      job_ref,
      job_id,
      due_date,
      status,
      client_name,
      net_amount,
      vat_treatment,
      vat_rate,
      vat_amount,
      amount,
      currency,
      payment_terms,
      invoice_origin,
      invoice_generation_idempotency_key
    ) VALUES (
      v_legacy_invoice_id,
      v_supplier_company_id,
      v_user_id,
      'P0-09-LEGACY-ZERO',
      'P0-09-JOB',
      v_job_id,
      current_date + 14,
      'Pending'::public.invoice_status,
      'P0-09 Synthetic Buyer',
      0,
      'not_registered',
      0,
      0,
      0,
      'GBP',
      '14 days',
      'marketplace',
      'p0-09-legacy-' || v_legacy_invoice_id::text
    );

    EXECUTE 'ALTER TABLE public.invoices ENABLE TRIGGER trg_guard_xdrive_invoice_vat_contract';
    EXECUTE 'ALTER TABLE public.invoices ENABLE TRIGGER trg_validate_invoice_snapshot_integrity';

    EXECUTE 'ALTER TABLE public.invoices DISABLE TRIGGER trg_validate_invoice_snapshot_integrity';
    UPDATE public.invoices
    SET status = 'void'::public.invoice_status,
        updated_at = now()
    WHERE id = v_legacy_invoice_id
      AND commercial_agreement_id IS NULL
      AND invoice_origin = 'marketplace'
      AND COALESCE(amount, 0) <= 0
      AND COALESCE(net_amount, 0) <= 0
      AND NOT EXISTS (SELECT 1 FROM public.invoice_documents d WHERE d.invoice_id = v_legacy_invoice_id)
      AND NOT EXISTS (SELECT 1 FROM public.invoice_payment_history p WHERE p.invoice_id = v_legacy_invoice_id)
      AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.invoice_id = v_legacy_invoice_id);
    EXECUTE 'ALTER TABLE public.invoices ENABLE TRIGGER trg_validate_invoice_snapshot_integrity';

    IF NOT EXISTS (
      SELECT 1
      FROM public.invoices
      WHERE id = v_legacy_invoice_id
        AND lower(status::text) = 'void'
        AND COALESCE(amount, 0) <= 0
        AND COALESCE(net_amount, 0) <= 0
    ) THEN
      RAISE EXCEPTION 'Legacy zero-value test invoice was not preserved as void audit history.';
    END IF;

    -- Target triggers must be enabled before the fixture rollback is forced.
    IF EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid IN ('public.invoices'::regclass, 'public.job_commercial_agreements'::regclass)
        AND tgname IN (
          'trg_guard_xdrive_invoice_vat_contract',
          'trg_validate_invoice_snapshot_integrity',
          'trg_sync_invoice_money_snapshot',
          'trg_lock_commercial_agreement_update'
        )
        AND tgenabled <> 'O'
    ) THEN
      RAISE EXCEPTION 'P0-09 finance target trigger was not restored after synthetic setup.';
    END IF;

    SELECT count(*) INTO v_bad_settings
    FROM public.company_settings cs
    JOIN public.companies c ON c.id = cs.company_id
    WHERE NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL
      AND (cs.default_vat_rate <> 0 OR cs.default_vat_treatment <> 'not_registered');

    SELECT count(*) INTO v_bad_agreements
    FROM public.job_commercial_agreements a
    JOIN public.companies c ON c.id = a.supplier_company_id
    WHERE NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL
      AND (
        a.vat_treatment <> 'not_registered'
        OR a.vat_rate <> 0
        OR a.vat_amount <> 0
        OR abs(a.agreed_gross_amount - a.agreed_amount) > 0.01
      );

    SELECT count(*) INTO v_bad_invoices
    FROM public.invoices i
    WHERE lower(i.status::text) <> 'void'
      AND (
        i.net_amount <= 0
        OR i.amount <= 0
        OR abs(i.subtotal - i.net_amount) > 0.01
        OR abs(i.total - i.amount) > 0.01
        OR abs(i.agreed_gross_amount - i.amount) > 0.01
        OR (i.vat_treatment <> 'reverse_charge' AND abs(i.amount - (i.net_amount + i.vat_amount)) > 0.01)
        OR (i.vat_treatment = 'reverse_charge' AND abs(i.amount - i.net_amount) > 0.01)
      );

    IF v_bad_settings <> 0 OR v_bad_agreements <> 0 OR v_bad_invoices <> 0 THEN
      RAISE EXCEPTION
        'P0-09 runtime postcondition failed: settings=%, agreements=%, invoices=%',
        v_bad_settings, v_bad_agreements, v_bad_invoices;
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = 'PZ091',
      MESSAGE = 'rollback synthetic P0-09 finance runtime proof';
  EXCEPTION
    WHEN SQLSTATE 'PZ091' THEN
      NULL;
  END;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id)
     OR EXISTS (SELECT 1 FROM public.companies WHERE id IN (v_supplier_company_id, v_buyer_company_id))
     OR EXISTS (SELECT 1 FROM public.jobs WHERE id = v_job_id)
     OR EXISTS (SELECT 1 FROM public.job_bids WHERE id = v_bid_id)
     OR EXISTS (SELECT 1 FROM public.job_commercial_agreements WHERE id = v_agreement_id)
     OR EXISTS (SELECT 1 FROM public.invoices WHERE id IN (v_invoice_id, v_legacy_invoice_id)) THEN
    RAISE EXCEPTION 'P0-09 synthetic finance fixture did not roll back cleanly.';
  END IF;

  -- Final zero-tolerance checks apply to any real rows present in the target DB.
  SELECT count(*) INTO v_bad_settings
  FROM public.company_settings cs
  JOIN public.companies c ON c.id = cs.company_id
  WHERE NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL
    AND (cs.default_vat_rate <> 0 OR cs.default_vat_treatment <> 'not_registered');

  SELECT count(*) INTO v_bad_agreements
  FROM public.job_commercial_agreements a
  JOIN public.companies c ON c.id = a.supplier_company_id
  WHERE NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL
    AND (
      a.vat_treatment <> 'not_registered'
      OR a.vat_rate <> 0
      OR a.vat_amount <> 0
      OR abs(a.agreed_gross_amount - a.agreed_amount) > 0.01
    );

  SELECT count(*) INTO v_bad_invoices
  FROM public.invoices i
  WHERE lower(i.status::text) <> 'void'
    AND (
      i.net_amount <= 0
      OR i.amount <= 0
      OR abs(i.subtotal - i.net_amount) > 0.01
      OR abs(i.total - i.amount) > 0.01
      OR abs(i.agreed_gross_amount - i.amount) > 0.01
      OR (i.vat_treatment <> 'reverse_charge' AND abs(i.amount - (i.net_amount + i.vat_amount)) > 0.01)
      OR (i.vat_treatment = 'reverse_charge' AND abs(i.amount - i.net_amount) > 0.01)
    );

  IF v_bad_settings <> 0 OR v_bad_agreements <> 0 OR v_bad_invoices <> 0 THEN
    RAISE EXCEPTION
      'P0-09 runtime postcondition failed: settings=%, agreements=%, invoices=%',
      v_bad_settings, v_bad_agreements, v_bad_invoices;
  END IF;
END;
$$;

COMMIT;
