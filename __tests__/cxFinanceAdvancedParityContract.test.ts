import fs from 'node:fs';
import path from 'node:path';

const financeDashboard = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/FinanceControlDashboardHome.tsx'), 'utf8');
const invoiceDetail = fs.readFileSync(path.join(process.cwd(), 'app/admin/invoices/[id]/page.tsx'), 'utf8');
const paymentHistory = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/invoices/[id]/payment-history/route.ts'), 'utf8');
const statements = fs.readFileSync(path.join(process.cwd(), 'app/admin/finance/statements/page.tsx'), 'utf8');
const financeHome = fs.readFileSync(path.join(process.cwd(), 'app/admin/finance/page.tsx'), 'utf8');

describe('CX-close finance and accounting parity', () => {
  it('keeps Ready to Invoice as a derived queue, not a fabricated job lifecycle state', () => {
    expect(financeDashboard).toContain("classifyWorkspaceJobStage(job) === 'completed'");
    expect(financeDashboard).toContain('!issuedInvoiceJobIds.has(job.id)');
    expect(financeDashboard).toContain('This is a derived finance queue, not a new job lifecycle status.');
    expect(financeDashboard).toContain('Create invoice');
    expect(financeDashboard).toContain('/admin/invoices/new?');
  });

  it('keeps off-platform payment reconciliation role-checked and idempotent', () => {
    expect(invoiceDetail).toContain("fetch(`/api/admin/invoices/${invoiceId}/payment-history`");
    expect(invoiceDetail).toContain('settlement_method: paymentInput.method');
    expect(invoiceDetail).toContain('external_reference: paymentInput.reference.trim() || null');
    expect(invoiceDetail).toContain('idempotency_key: crypto.randomUUID()');
    expect(paymentHistory).toContain('canRecordInvoicePayments(callerRole)');
    expect(paymentHistory).toContain('invoice_payment_history');
    expect(paymentHistory).toContain('Payment amount exceeds the outstanding invoice balance.');
  });

  it('provides company-scoped statements without mutating accounting state', () => {
    expect(statements).toContain('title="Statements"');
    expect(statements).toContain('Export Statement CSV');
    expect(statements).toContain('COUNTERPARTY');
    expect(statements).toContain('FROM');
    expect(statements).toContain('TO');
    expect(statements).toContain("data.invoices");
    expect(statements).not.toContain(".from('invoices').update(");
    expect(statements).not.toContain(".from('invoice_payment_history').insert(");
    expect(financeHome).toContain("router.push('/admin/finance/statements')");
  });

  it('does not pretend external invoice upload or batch mutation exists', () => {
    expect(statements).not.toContain('Upload invoice');
    expect(statements).not.toContain('Batch mark paid');
    expect(financeDashboard).not.toContain('Batch mark paid');
  });
});
