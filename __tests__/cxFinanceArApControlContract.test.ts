import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX finance AR/AP control contract', () => {
  const route = read('app/api/workspace/finance/control/route.ts');
  const control = read('app/components/workspace/WorkspaceFinanceControl.tsx');

  it('derives AR/AP from canonical buyer and supplier ownership with verified payment history', () => {
    expect(route).toContain(".from('invoice_payment_history')");
    expect(route).toContain("direction: Direction = supplierOwned");
    expect(route).toContain("counterpartyCompanyId = direction === 'receivable' ? buyerCompanyId : supplierCompanyId");
    expect(route).toContain("outstandingAmount: Math.max(0, gross - paidAmount)");
    expect(route).toContain('No payment state is fabricated.');
  });

  it('keeps net VAT gross and lifecycle dimensions separate', () => {
    for (const marker of ['net,', 'vat,', 'gross,', "'awaiting_payment'", "'overdue'", "'paid'", "'archive'"]) expect(route).toContain(marker);
    for (const label of ['Net', 'VAT', 'Gross', 'Paid', 'Outstanding', 'Awaiting Payment', 'Counterparties', 'Archive']) expect(control).toContain(label);
  });

  it('derives Ready to Invoice from completed canonical jobs without creating a new lifecycle state', () => {
    expect(route).toContain("const COMPLETED_JOB_STATUSES = new Set(['delivered', 'completed'])");
    expect(route).toContain('invoiceJobIds.has(String(job.id))');
    expect(control).toContain('Ready to Invoice');
  });

  it('is integrated into carrier broker and customer finance surfaces', () => {
    expect(read('app/admin/finance/page.tsx')).toContain('<WorkspaceFinanceControl role="carrier" />');
    expect(read('app/broker/finance/page.tsx')).toContain('<WorkspaceFinanceControl role="broker" />');
    expect(read('app/customer/invoices/page.tsx')).toContain('<WorkspaceFinanceControl role="customer" />');
  });

  it('does not mutate payment or invoice state from the overview', () => {
    expect(control).not.toContain("method: 'POST'");
    expect(control).not.toContain("method: 'PATCH'");
    expect(control).not.toContain('refund');
    expect(control).not.toContain('payout');
  });

  it('enriches Driver finance with recorded paid and outstanding values', () => {
    const driverApi = read('app/api/driver/finance/invoices/route.ts');
    const driverPage = read('app/driver/finance/page.tsx');
    expect(driverApi).toContain(".from('invoice_payment_history')");
    expect(driverApi).toContain('paid_amount');
    expect(driverApi).toContain('outstanding_amount');
    expect(driverApi).toContain('valueSummary');
    expect(driverPage).toContain('Recorded paid');
    expect(driverPage).toContain('Outstanding');
    expect(driverPage).toContain('Net {money(invoice.net_amount');
  });

  it('gives Super Admin platform-wide buyer/supplier trade control without financial mutation', () => {
    const superApi = read('app/api/super-admin/finance/route.ts');
    const superPage = read('app/super-admin/finance/control/page.tsx');
    expect(superApi).toContain("section === 'control'");
    expect(superApi).toContain('buyer_name');
    expect(superApi).toContain('supplier_name');
    expect(superApi).toContain('partialPayments');
    expect(superPage).toContain('Platform trade ledger');
    expect(superPage).toContain('Partial payments');
    expect(superPage).not.toContain("method: 'POST'");
  });
});
