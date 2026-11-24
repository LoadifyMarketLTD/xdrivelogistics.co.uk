import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'app/components/workspace/WorkspaceFinanceControl.tsx'),
  'utf8',
);

// These are source-contract regression checks, not authenticated browser tests.
describe('Company Admin finance navigation contract', () => {
  it('keeps receivable and payable registers available to carrier admins', () => {
    expect(source).toContain("['receivable', 'Accounts Receivable']");
    expect(source).toContain("['payable', 'Accounts Payable']");
    expect(source).toContain("if (view === 'receivable') return invoices.filter((invoice) => invoice.direction === 'receivable')");
    expect(source).toContain("if (view === 'payable') return invoices.filter((invoice) => invoice.direction === 'payable')");
    expect(source).not.toContain("invoices.filter((invoice) => invoice.direction === 'receivable')\n      : invoices");
  });

  it('opens payable invoices in their dedicated detail workspace', () => {
    expect(source).toContain("invoice.direction === 'payable'");
    expect(source).toContain("`/admin/finance/carrier-invoices/${invoice.id}`");
    expect(source).toContain("`/admin/invoices/${invoice.id}`");
  });

  it('shows carrier payable exposure separately from receivable exposure', () => {
    expect(source).toContain("money(summary?.payableOutstanding ?? 0)");
    expect(source).toContain("summary?.receivableOutstanding ?? 0");
    expect(source).toContain("summary?.payableAging?.[bucket]");
    expect(source).toContain("summary?.receivableAging?.[bucket]");
  });
});
