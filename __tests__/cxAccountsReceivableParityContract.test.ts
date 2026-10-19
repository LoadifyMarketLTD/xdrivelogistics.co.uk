import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ui = readFileSync(resolve(process.cwd(), 'app/components/workspace/WorkspaceFinanceControl.tsx'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'app/api/workspace/finance/control/route.ts'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'app/admin/finance/page.tsx'), 'utf8');
const statements = readFileSync(resolve(process.cwd(), 'app/admin/finance/statements/page.tsx'), 'utf8');

describe('CX Accounts Receivable parity contract', () => {
  it('uses the CX live Accounts Receivable tab order for the carrier workspace', () => {
    const labels = [
      "['dashboard', 'Dashboard']",
      "['all', 'All']",
      "['ready', 'Ready To Invoice']",
      "['awaiting', 'Awaiting Payment']",
      "['paid', 'Paid']",
      "['customers', 'Customers']",
      "['archive', 'Archive']",
      "['statements', 'Statements']",
    ];
    let previous = -1;
    for (const label of labels) {
      const index = ui.indexOf(label);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(page).toContain('title="Accounts Receivable"');
  });

  it('provides customer filtering, CSV export and invoiced/payment aggregates', () => {
    expect(ui).toContain('FILTER CUSTOMERS');
    expect(ui).toContain('xdrive-accounts-receivable-customers.csv');
    expect(ui).toContain('Total invoiced · Number');
    expect(ui).toContain('Payment received · Number');
    for (const field of [
      'totalInvoicedCount',
      'totalInvoicedNet',
      'totalInvoicedGross',
      'paymentsReceivedCount',
      'paymentsReceivedNet',
      'paymentsReceivedGross',
    ]) {
      expect(route).toContain(field);
    }
    expect(route).toContain("select('id, name, xd_id')");
  });

  it('keeps statements as an income-statement workflow with invoice-date and range controls', () => {
    expect(ui).toContain("router.push('/admin/finance/statements')");
    expect(statements).toContain('Income Statement');
    expect(statements).toContain('Invoice date');
    expect(statements).toContain('FROM');
    expect(statements).toContain('TO');
    expect(statements).toContain('Generate');
  });

  it('restricts company finance control to owner, admin and finance memberships', () => {
    expect(route).toContain("['owner', 'admin', 'finance'].includes");
    expect(route).toContain('Finance access requires an owner, admin or finance company role.');
    expect(route).not.toContain("['owner', 'admin', 'dispatcher'].includes");
  });
});
