import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const page = read('app/admin/invoices/page.tsx');
const finance = read('app/components/workspace/WorkspaceFinanceControl.tsx');
const css = read('app/components/workspace/InvoiceProFinance.module.css');

describe('approved Customer finance register reused by Company/Carrier', () => {
  it('uses the approved Customer finance model, not the retired CX summary register', () => {
    expect(page).toContain('<WorkspaceFinanceControl role="carrier" />');
    expect(read('app/customer/invoices/page.tsx')).toContain('<WorkspaceFinanceControl role="customer" />');
    expect(finance).toContain("import styles from './InvoiceProFinance.module.css'");
    for (const label of ['Dashboard', 'All', 'Ready to Invoice', 'Awaiting Payment', 'Paid', 'Statements']) {
      expect(finance).toContain(label);
    }
  });

  it('preserves account direction, invoice lifecycle, payment drill-down and real backend authorization', () => {
    expect(finance).toContain("invoice.direction === 'receivable'");
    expect(finance).toContain("invoice.direction === 'payable'");
    expect(finance).toContain('invoice.lifecycle ===');
    expect(finance).toContain('router.push(detailHref(role, invoice))');
    expect(finance).toContain('`/admin/invoices/${invoice.id}`');
    expect(finance).toContain("'/api/workspace/finance/control'");
    expect(read('app/api/workspace/finance/control/route.ts')).toContain('hasWorkspaceCapabilityForContext');
  });

  it('never fabricates unverified accounting actions or demo invoices', () => {
    expect(page).not.toContain('Ready to Invoice / external invoice parity');
    expect(finance).not.toContain('publishDemoLoad');
    expect(finance).not.toContain('mockInvoices');
  });

  it('uses the same approved responsive geometry for Customer, Broker and Company', () => {
    expect(css).toContain('.surface');
    expect(css).toContain('.nav');
    expect(css).toContain('.hero');
    expect(css).toContain('.register');
  });

  it('keeps tenant finance separate from global Super Admin finance', () => {
    expect(page).not.toContain('/super-admin');
    expect(finance).not.toContain('/api/super-admin');
  });
});
