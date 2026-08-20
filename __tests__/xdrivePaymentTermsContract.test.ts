import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { COMPANY_CONFIG } from '../app/config/company';
import {
  computeInvoiceDueDate,
  normalizeXDrivePaymentTerm,
  paymentTermDays,
  XDRIVE_SPECIAL_EXTENSION_DAYS,
} from '../lib/invoicePaymentTerms';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260820105000_canonical_xdrive_payment_terms_and_special_extension.sql',
  ),
  'utf8',
);
const autoInvoice = readFileSync(
  resolve(process.cwd(), 'app/api/_lib/autoGenerateMarketplaceInvoice.ts'),
  'utf8',
);
const manualInvoice = readFileSync(
  resolve(process.cwd(), 'app/admin/invoices/new/page.tsx'),
  'utf8',
);
const extensionRoute = readFileSync(
  resolve(process.cwd(), 'app/api/admin/invoices/[id]/extend-due-date/route.ts'),
  'utf8',
);
const submitRoute = readFileSync(
  resolve(process.cwd(), 'app/api/driver/finance/invoices/[id]/submit/route.ts'),
  'utf8',
);

describe('XDrive financial payment-term contract', () => {
  it('exposes only Pay now, 14 days and 30 days as standard payment terms', () => {
    expect(COMPANY_CONFIG.payment.terms).toEqual(['Pay now', '14 days', '30 days']);
    expect(COMPANY_CONFIG.payment.specialExtensionDays).toBe(15);
    expect(XDRIVE_SPECIAL_EXTENSION_DAYS).toBe(15);
  });

  it('rejects 45/60-day base terms while preserving due-on-receipt aliases', () => {
    expect(normalizeXDrivePaymentTerm('due on receipt')).toBe('Pay now');
    expect(normalizeXDrivePaymentTerm('14 days')).toBe('14 days');
    expect(normalizeXDrivePaymentTerm('30 days')).toBe('30 days');
    expect(normalizeXDrivePaymentTerm('45 days')).toBeNull();
    expect(normalizeXDrivePaymentTerm('60 days')).toBeNull();
    expect(paymentTermDays('Pay now')).toBe(0);
    expect(paymentTermDays('14 days')).toBe(14);
    expect(paymentTermDays('30 days')).toBe(30);
  });

  it('keeps the 30-day contract unchanged when the exceptional +15 days is applied', () => {
    expect(computeInvoiceDueDate('2026-08-20', '30 days')).toBe('2026-09-19');
    expect(computeInvoiceDueDate('2026-08-20', '30 days', 15)).toBe('2026-10-04');
    expect(() => computeInvoiceDueDate('2026-08-20', '30 days', 30 as unknown as 15)).toThrow(
      'XDrive payment extensions may only be 15 days.',
    );
  });

  it('enforces the base contract and one controlled extension in the database', () => {
    expect(migration).toContain("CHECK (payment_terms IN ('Pay now', '14 days', '30 days'))");
    expect(migration).toContain('CHECK (payment_due_days IN (0, 14, 30))');
    expect(migration).toContain('CHECK (payment_extension_days IN (0, 15))');
    expect(migration).toContain('maximum +15 day payment extension');
    expect(migration).toContain("COALESCE(v_role, '') NOT IN ('owner', 'admin', 'finance')");
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.extend_invoice_due_date_special');
    expect(migration).toContain('TO service_role;');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.extend_invoice_due_date_special');
  });

  it('does not allow marketplace invoice generation to trust arbitrary due-day values', () => {
    expect(autoInvoice).toContain('normalizeXDrivePaymentTerm');
    expect(autoInvoice).toContain('dueDays !== paymentTermDays(paymentTerms)');
    expect(autoInvoice).toContain('computeInvoiceDueDate(invoiceDate, paymentTerms)');
  });

  it('keeps manual invoice creation limited to the three standard terms', () => {
    expect(manualInvoice).toContain('<option value="Pay now">Pay now</option>');
    expect(manualInvoice).toContain('<option value="14 days">14 days</option>');
    expect(manualInvoice).toContain('<option value="30 days">30 days</option>');
    expect(manualInvoice).not.toContain('<option value="45 days">');
    expect(manualInvoice).not.toContain('<option value="60 days">');
  });

  it('requires a reason and authenticated actor before the server calls the extension RPC', () => {
    expect(extensionRoute).toContain('z.string().trim().min(10).max(2000)');
    expect(extensionRoute).toContain('authData.user.id');
    expect(extensionRoute).toContain("supabaseAdmin.rpc('extend_invoice_due_date_special'");
    expect(extensionRoute).toContain('extensionDays: 15');
  });

  it('does not invent a weekly late-payment penalty in invoices or delivery emails', () => {
    expect(COMPANY_CONFIG.payment.lateFeeNote).toContain('statutory interest');
    expect(COMPANY_CONFIG.payment.lateFeeAmount).toContain('legally and contractually applicable');
    expect(submitRoute).toContain('statutory interest and recovery-cost compensation where applicable');
    expect(submitRoute).not.toContain('£25.00 per week');
    expect(submitRoute).not.toContain('more than 7 days overdue');
  });
});
