import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver booking storyboard page 9', () => {
  it('uses an isolated Invoice Draft component for the canonical Draft invoice state', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain('approvedScreen.number===9 && sheet?.invoices[0]?.id');
    expect(source).toContain('<InvoiceDraftStep');
  });

  it('normalises legacy database invoice states before the workflow chooses a screen', () => {
    const sheet=fs.readFileSync(path.join(process.cwd(),'app/api/driver/jobs/[jobId]/sheet/route.ts'),'utf8');
    expect(sheet).toContain('toCanonicalInvoiceStatus(text(entry.status))');
    expect(sheet).toContain('toCanonicalPaymentStatus(text(entry.payment_status))');
  });

  it('reads invoice values from the persisted invoice snapshot, not storyboard booking totals', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    const start=source.indexOf('approvedScreen.number===9');
    const end=source.indexOf('return <div className="fresh-mobile-booking"',start);
    const block=source.slice(start,end);
    expect(block).toContain('invoice.clientName');
    expect(block).toContain('invoice.issuerName');
    expect(block).toContain('invoice.netAmount');
    expect(block).toContain('invoice.vatAmount');
    expect(block).toContain('invoice.amount');
    expect(block).toContain('invoice.paymentTerms');
    expect(block).not.toContain('sheet?.agreedRate');
    expect(block).not.toContain('sheet?.vatAmount');
  });

  it('uses real invoice PDF preview and edit routes', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain('const openInvoicePreview = async (invoiceId:string) =>');
    expect(source).toContain('/api/driver/finance/invoices/${encodeURIComponent(invoiceId)}/preview');
    expect(source).toContain("'/driver/finance/invoices/'+encodeURIComponent(invoice.id!)+'/edit'");
    const page=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/InvoiceDraftStep.tsx'),'utf8');
    expect(page).toContain('Preview PDF');
    expect(page).toContain('Edit Draft');
    expect(page).toContain('Review Invoice');
  });
});
