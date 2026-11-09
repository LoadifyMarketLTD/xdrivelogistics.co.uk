import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) => fs.readFileSync(path.join(process.cwd(), name), 'utf8');

describe('Owner Driver invoice workflow reused across authorized workspaces', () => {
  const owner = read('app/driver/finance/page.tsx');
  const business = read('app/components/workspace/WorkspaceFinanceControl.tsx');
  const editor = read('app/components/workspace/InvoiceCreateWorkflow.tsx');
  const api = read('app/api/workspace/finance/control/route.ts');

  it('preserves the existing Owner Driver draft-review-send workflow untouched', () => {
    expect(owner).toContain('/api/driver/finance/jobs/eligible');
    expect(owner).toContain('generate-invoice');
    expect(owner).toContain('/driver/finance/invoices/');
    expect(owner).toContain('<InvoiceProSurface');
  });
  it('reuses one original invoice editor for Carrier and Broker, with role-correct URLs', () => {
    expect(read('app/admin/invoices/new/page.tsx')).toContain('<InvoiceCreateWorkflow workspace="carrier" />');
    expect(read('app/broker/customer-invoices/new/page.tsx')).toContain('<InvoiceCreateWorkflow workspace="broker" />');
    expect(editor).toContain("workspace === 'broker' ? '/broker/customer-invoices' : '/admin/invoices'");
    expect(editor).toContain("workspace === 'broker' ? '/broker/jobs' : '/admin/jobs'");
    expect(editor).toContain("fetch('/api/admin/invoices'");
    expect(editor).not.toContain('href="/admin/invoices"');
    expect(editor).not.toContain('href="/admin/jobs"');
    expect(editor).toContain('hasCompletePodEvidence');
  });
  it('opens the proper POD-gated invoice draft form from ready work', () => {
    expect(business).toContain('/broker/customer-invoices/new');
    expect(business).toContain('/admin/invoices/new');
    expect(business).toContain('encodeURIComponent(job.id)');
    expect(business).toContain('Create draft');
    expect(business).toContain("role === 'customer' ? []");
  });
  it('never labels a job ready before complete POD and keeps server capabilities', () => {
    expect(api).toContain('hasCompletePodEvidence(job)');
    expect(api).toContain('hasWorkspaceCapabilityForContext');
    expect(read('app/api/admin/invoices/route.ts')).toContain("requireCompanyCapability(request, parsed.data.companyId");
    expect(read('app/api/admin/invoices/route.ts')).toContain('POD_REQUIRED_BEFORE_INVOICE');
  });
});
