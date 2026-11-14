import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (name: string) => fs.readFileSync(path.join(process.cwd(), name), 'utf8');
const frame = read('app/components/workspace/InvoiceProMasterFrame.tsx');
const driver = read('app/driver/finance/page.tsx');
const business = read('app/components/workspace/WorkspaceFinanceControl.tsx');
const superAdmin = read('app/super-admin/finance/invoices/page.tsx');
const css = read('app/components/workspace/InvoiceProFinance.module.css');
const all = [driver, business, superAdmin];

describe('Single approved 3193 Driver Finance model, all permitted workspaces', () => {
  it('renders every Finance workspace through the same approved presentation primitives', () => {
    for (const src of all) {
      for (const key of ['InvoiceProSurface','InvoiceProMasterTabs','InvoiceProHero','InvoiceProMetrics','InvoiceProDashboard','InvoiceProRegister']) expect(src).toContain(`<${key}`);
      expect(src).not.toContain('DemoInvoicesBoard');
      expect(src).not.toContain('mockInvoices');
    }
    expect(frame).toContain('data-invoice-model="driver-3193"');
    expect(frame).toContain('InvoiceProFinance.module.css');
    expect(css).toContain('.nav');
  });
  it('preserves 3193 menu structure and one shared invoice-state tab component', () => {
    expect(frame).toContain('export function InvoiceProMasterTabs');
    expect(frame).toContain('export function InvoiceProStatusTabs');
    expect(driver).toContain('<InvoiceProStatusTabs');
    expect(business).toContain('<InvoiceProStatusTabs');
    expect(driver).toContain('Ready To Invoice');
    for (const label of ['Dashboard', 'All', 'Awaiting Payment', 'Paid', 'Archive', 'Statements']) expect(business).toContain(label);
  });
  it('keeps the real, distinct and authorised backend for every role', () => {
    expect(driver).toContain('/api/driver/finance/invoices');
    expect(driver).toContain('/api/driver/finance/jobs/eligible');
    expect(driver).toContain('generate-invoice');
    expect(business).toContain("const financeEndpoint = '/api/workspace/finance/control'");
    expect(business).toContain('Authorization: `Bearer ${token}`');
    expect(superAdmin).toContain('/api/super-admin/finance?section=invoices');
    expect(superAdmin).toContain("<ProtectedRoute allowedRoles={['owner']}>");
    expect(read('app/api/workspace/finance/control/route.ts')).toContain('hasWorkspaceCapabilityForContext');
  });
  it('uses approved 3193 model in every customer, broker and carrier invoice route', () => {
    for (const route of ['app/customer/invoices/page.tsx','app/admin/invoices/page.tsx','app/admin/finance/page.tsx','app/admin/finance/customer-invoices/page.tsx','app/admin/finance/carrier-invoices/page.tsx','app/broker/finance/page.tsx','app/broker/customer-invoices/page.tsx','app/broker/carrier-costs/page.tsx']) {
      expect(read(route)).toContain('WorkspaceFinanceControl');
    }
    expect(business).toContain('InvoiceProSurface');
    expect(business).toContain('setPayload(null)');
  });
});
