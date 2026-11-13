import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261111124500_invoice_payment_trigger_net_stripe_reconciliation.sql'),
  'utf8',
);

describe('FIN-03 invoice payment trigger parity with Stripe net settlement', () => {
  it('preserves existing invoice trigger function signature and company boundary', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_apply_invoice_payment\(\)/);
    expect(sql).toMatch(/WHERE id = NEW\.invoice_id AND company_id = NEW\.company_id/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/RETURNS trigger/);
  });

  it('deducts capped refunds and lost disputes, never pending or won disputes', () => {
    expect(sql).toMatch(/LEAST\(a\.amount_minor/);
    expect(sql).toMatch(/public\.invoice_stripe_reversals/);
    expect(sql).toMatch(/public\.invoice_stripe_disputes/);
    expect(sql).toMatch(/d\.status = 'lost'/);
    expect(sql).toMatch(/v_net_paid := GREATEST\(0, v_gross_paid - v_reversed\)/);
    expect(sql).toMatch(/fn_calculate_invoice_payment_status\(v_invoice_amount, v_net_paid\)/);
  });

  it('clears paid_at for reopened invoices and preserves settled payment timestamps', () => {
    expect(sql).toMatch(/WHEN v_payment_status = 'paid'/);
    expect(sql).toMatch(/COALESCE\(v_paid_at, NEW\.paid_at, now\(\)\) ELSE NULL/);
  });
});
