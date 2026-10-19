import fs from 'node:fs';
import path from 'node:path';

const register = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/InvoiceRegisterPage.tsx'), 'utf8');
const statements = fs.readFileSync(path.join(process.cwd(), 'app/admin/finance/statements/page.tsx'), 'utf8');

describe('CX live Accounts Receivable parity contract', () => {
  it('keeps the eight CX Accounts Receivable destinations in order', () => {
    const labels = ['Dashboard', 'All', 'Ready To Invoice', 'Awaiting Payment', 'Paid', 'Customers', 'Archive', 'Statements'];
    let cursor = -1;
    for (const label of labels) {
      const next = register.indexOf(label, cursor + 1);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
  });

  it('provides the neutral CX controls without SmartPay intermediation', () => {
    expect(register).toContain('Group by customer');
    expect(register).toContain('Search Accounts Receivable');
    expect(register).toContain('Clear filters');
    expect(register).toContain('No. of Records');
    expect(register).toContain('Payment received · Number');
    expect(register).not.toContain('Pay me now');
    expect(register).not.toContain('Early payment only');
  });

  it('requires canonical complete POD before a job enters Ready To Invoice', () => {
    expect(register).toContain('hasCompletePodEvidence(job)');
    expect(register).not.toContain("classifyWorkspaceJobStage(job) === 'completed' && job.pod_generated === true");
  });

  it('keeps statements inside the same Accounts Receivable tab family', () => {
    expect(statements).toContain('role="tablist"');
    expect(statements).toContain("'/admin/finance/customer-invoices?view=' + view");
    expect(statements).toContain('aria-selected={true}');
    expect(statements).toContain('Income Statement');
    expect(statements).toContain('Invoice date');
  });
});
