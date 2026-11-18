import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Customer Post Load payment terms contract', () => {
  const form = read('app/components/workspace/LoadPostingForm.tsx');
  const createRoute = read('app/api/jobs/create/route.ts');

  it('shows canonical XDrive payment terms automatically on Post Load', () => {
    expect(form).toContain("const PAYMENT_TERMS = COMPANY_CONFIG.payment.terms");
    expect(form).toContain("paymentTerms: COMPANY_CONFIG.payment.defaultTerm");
    expect(form).toContain("value={form.paymentTerms}");
    expect(form).toContain("PAYMENT_TERMS.map((term)");
  });

  it('persists payment terms on every created job', () => {
    expect(form).toContain("paymentTerms: form.paymentTerms");
    expect(createRoute).toContain("payment_terms: externalDirectTarget?.paymentTerms ?? input.paymentTerms");
  });

  it('rejects base terms beyond 30 days at the API boundary', () => {
    const canonical = "z.enum(['Pay now', '14 days', '30 days'])";
    expect(createRoute).toContain(`paymentTerms: ${canonical}.optional().default('14 days')`);
    expect(createRoute).toContain(`paymentTerms: ${canonical}.optional().nullable()`);
    expect(createRoute).not.toContain("'45 days'");
    expect(createRoute).not.toContain("'60 days'");
    expect(createRoute).not.toContain("'90 days'");
  });
});
