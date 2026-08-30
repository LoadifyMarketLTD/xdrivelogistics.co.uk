import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const reconciliation = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830194000_reconcile_finance_vat_snapshot_integrity.sql'),
  'utf8',
);
const triggerCoverage = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830194100_harden_finance_vat_trigger_coverage.sql'),
  'utf8',
);
const runtimeProof = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830194200_verify_finance_vat_snapshot_runtime.sql'),
  'utf8',
);

describe('finance VAT snapshot integrity', () => {
  it('repairs only provable non-VAT and marked test-fixture history', () => {
    expect(reconciliation).toContain("default_vat_treatment = 'not_registered'");
    expect(reconciliation).toContain('default_vat_rate = 0');
    expect(reconciliation).toContain('COALESCE(j.is_test, false) = true');
    expect(reconciliation).toContain("a.vat_treatment = 'not_registered'");
    expect(reconciliation).toContain("SET status = 'void'::public.invoice_status");
    expect(reconciliation).toContain('NOT EXISTS (SELECT 1 FROM public.invoice_payment_history');
  });

  it('keeps commercial agreements immutable outside the transaction-scoped repair', () => {
    expect(reconciliation).toContain('DISABLE TRIGGER trg_lock_commercial_agreement_update');
    expect(reconciliation).toContain('ENABLE TRIGGER trg_lock_commercial_agreement_update');
    expect(runtimeProof).toContain('Commercial agreement immutability was not restored.');
  });

  it('owns every duplicate invoice money field at the database boundary', () => {
    expect(reconciliation).toContain('fn_sync_invoice_money_snapshot');
    expect(reconciliation).toContain('NEW.subtotal := round(NEW.net_amount, 2)');
    expect(reconciliation).toContain('NEW.total := round(NEW.amount, 2)');
    expect(reconciliation).toContain('NEW.agreed_gross_amount := round(NEW.amount, 2)');
  });

  it('aligns database validation with reverse-charge payable totals', () => {
    expect(reconciliation).toContain("WHEN NEW.vat_treatment = 'reverse_charge' THEN round(NEW.net_amount, 2)");
    expect(reconciliation).toContain('Invoice payable total is inconsistent with VAT treatment.');
    expect(reconciliation).toContain('NEW.vat_treatment IS DISTINCT FROM agreement.vat_treatment');
  });

  it('covers direct VAT treatment, snapshot and duplicate-field writes with both guards', () => {
    expect(triggerCoverage).toContain('trg_guard_xdrive_invoice_vat_contract');
    expect(triggerCoverage).toContain('trg_validate_invoice_snapshot_integrity');
    expect(triggerCoverage).toContain('vat_treatment');
    expect(triggerCoverage).toContain('subtotal');
    expect(triggerCoverage).toContain('agreed_gross_amount');
    expect(triggerCoverage).toContain('issuer_vat_number_snapshot');
    expect(triggerCoverage).toContain('customer_vat_number_snapshot');
  });

  it('contains rollback-only mutation probes and zero-tolerance postconditions', () => {
    expect(runtimeProof).toContain('rollback finance sync probe');
    expect(runtimeProof).toContain("WHEN SQLSTATE '23514'");
    expect(runtimeProof).toContain('Non-VAT issuer accepted a taxable invoice treatment.');
    expect(runtimeProof).toContain('P0-09 runtime postcondition failed');
    expect(runtimeProof).toContain('Legacy zero-value test invoice was not preserved as void audit history.');
  });
});
