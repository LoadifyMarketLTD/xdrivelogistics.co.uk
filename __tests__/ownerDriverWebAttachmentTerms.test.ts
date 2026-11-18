import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { validateInvoiceAttachmentSnapshot } from '../lib/server/invoiceAttachmentSnapshot';
import { computeInvoiceDueDate, normalizeXDrivePaymentTerm, paymentTermDays } from '../lib/invoicePaymentTerms';

async function fixture(name:string,count:number) {
  const pdf=await PDFDocument.create();
  for(let i=0;i<count;i++)pdf.addPage([595.28,841.89]);
  return {filename:name,content:Buffer.from(await pdf.save()).toString('base64')};
}
describe('Transferred invoice attachment contract',()=>{
  it('allows only separate invoice and POD for newly frozen job invoices',async()=>{
    const invoice=await fixture('invoice.pdf',1),pod=await fixture('pod.pdf',3);
    expect(await validateInvoiceAttachmentSnapshot([invoice,pod],true,false)).toBeNull();
    expect(await validateInvoiceAttachmentSnapshot([invoice],true,false)).toMatch(/Separate/);
    expect(await validateInvoiceAttachmentSnapshot([invoice,await fixture('pod.pdf',1)],true,false)).toMatch(/incomplete/);
  });
  it('preserves a historical combined snapshot without changing its bytes',async()=>{
    const combined=await fixture('legacy.pdf',3),before=JSON.stringify(combined);
    expect(await validateInvoiceAttachmentSnapshot([combined],true,true)).toBeNull();
    expect(JSON.stringify(combined)).toBe(before);
    expect(await validateInvoiceAttachmentSnapshot([await fixture('legacy.pdf',1)],true,true)).toMatch(/incomplete/);
  });
  it('requires one valid page for manual invoice and rejects non-PDF data',async()=>{
    expect(await validateInvoiceAttachmentSnapshot([await fixture('manual.pdf',1)],false,false)).toBeNull();
    expect(await validateInvoiceAttachmentSnapshot([await fixture('manual.pdf',2)],false,false)).toMatch(/invalid/);
    expect(await validateInvoiceAttachmentSnapshot([{filename:'fake.pdf',content:'bm90IGEgcGRm'}],false,false)).toMatch(/invalid/);
  });
  it('normalizes approved 7-day terms and calculates dates exactly',()=>{
    for(const term of ['7 day','7 days','net 7'])expect(normalizeXDrivePaymentTerm(term)).toBe('7 days');
    expect(paymentTermDays('7 days')).toBe(7);
    expect(computeInvoiceDueDate('2026-11-18','7 days')).toBe('2026-11-25');
    expect(computeInvoiceDueDate('2026-11-18','7 days',15)).toBe('2026-12-10');
    expect(normalizeXDrivePaymentTerm('45 days')).toBeNull();
  });
});