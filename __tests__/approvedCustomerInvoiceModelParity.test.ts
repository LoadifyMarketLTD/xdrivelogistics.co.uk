import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const finance = source('app/components/workspace/WorkspaceFinanceControl.tsx');

describe('approved Customer invoice model reused across authorised workspaces', () => {
  it('preserves the approved production Customer source unchanged', () => {
    expect(source('app/customer/invoices/page.tsx')).toContain('<WorkspaceFinanceControl role="customer" />');
    expect(finance).toContain("import styles from './InvoiceProFinance.module.css'");
  });
  it('uses the same finance component for Company/Carrier and delegated finance screens', () => {
    expect(source('app/admin/invoices/page.tsx')).toContain('<WorkspaceFinanceControl role="carrier" />');
    expect(source('app/admin/finance/customer-invoices/page.tsx')).toContain('role="carrier" initialView="receivable"');
    expect(source('app/admin/finance/carrier-invoices/page.tsx')).toContain('role="carrier" initialView="payable"');
  });
  it('uses the approved finance model for Broker receivables and payables, preserving separate routes', () => {
    expect(source('app/broker/customer-invoices/page.tsx')).toContain('role="broker" initialView="receivable"');
    expect(source('app/broker/carrier-costs/page.tsx')).toContain('role="broker" initialView="payable"');
  });
  it('preserves real authenticated finance API, company authorization and invoice drilldown', () => {
    expect(finance).toContain("'/api/workspace/finance/control'");
    expect(finance).toContain('Authorization: `Bearer ${token}`');
    expect(source('app/api/workspace/finance/control/route.ts')).toContain("'invoices.customer.manage'");
    expect(finance).toContain('router.push(detailHref(role, invoice))');
    expect(finance).toContain('role === \'customer\'');
    expect(finance).not.toContain('publishDemoLoad');
  });
  it('retains the approved Driver finance visual styling and dedicated invoice workflow', () => {
    const driver = source('app/driver/finance/page.tsx');
    expect(driver).toContain("InvoiceProFinance.module.css");
    expect(driver).toContain('generate-invoice');
    expect(driver).toContain('/api/driver/finance/invoices');
  });
});

describe('Super Admin invoice parity without breaking global tenant isolation', () => {
  it('reuses approved Customer invoice visual primitives with the platform-only invoice endpoint', () => {
    const page = source('app/super-admin/finance/invoices/page.tsx');
    expect(page).toContain('InvoiceProFinance.module.css');
    expect(page).toContain('/api/super-admin/finance?section=invoices');
    expect(page).toContain("<ProtectedRoute allowedRoles={['owner']}>");
    expect(page).toContain('/super-admin/finance/invoices/');
    expect(page).not.toContain('/api/workspace/finance/control');
    expect(page).toContain('Monetary totals are not combined across currencies.');
  });
});
