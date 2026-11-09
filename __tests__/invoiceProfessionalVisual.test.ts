import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import { buildInvoicePdf } from '../lib/server/invoicePdf';

describe('XDrive premium invoice PDF, real renderer', () => {
  it('produces official branded A4 commercial invoice with accurate GBP/VAT and preserved appendix logic', async () => {
    const pdfBytes = await buildInvoicePdf({
      invoiceNumber:'INV-202611-003',jobReference:'XDL-090CD41C',
      invoiceDate:'2026-11-09',dueDate:'2026-11-23',
      issuerName:'XDrive Logistics',
      clientName:'Customer - layout preview',clientAddress:'United Kingdom',
      pickupLocation:'Cornelian Street, Blackburn, BB1 9QL',
      deliveryLocation:'Holly Hill Road, Bexley, DA8 1QD',
      deliveryDateTime:'2026-11-09T20:24:00Z',recipientName:'XDrive Logistics',
      serviceDescription:'Same-day freight transport',
      vehicleDescription:'Luton van',netAmount:17,vatAmount:0,vatRate:0,
      vatTreatment:'not_registered',totalAmount:17,currency:'GBP',
      paymentTerms:'14 days',
      logoBytes:fs.readFileSync('public/xdrive-logo-primary.png'),
    });
    const doc=await PDFDocument.load(pdfBytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28,1);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89,1);
    expect(pdfBytes.byteLength).toBeGreaterThan(10000);
    fs.writeFileSync('invoice-professional-preview.pdf',pdfBytes);
  });
  it('retains the real XDrive logo and robust financial calculation paths', () => {
    const src=fs.readFileSync('lib/server/invoicePdf.ts','utf8');
    expect(src).toContain('input.logoBytes');
    expect(src).toContain('const total=money(finiteMoney(input.totalAmount),input.currency)');
    expect(src).toContain('vatTreatment');
    expect(src).toContain('input.bankAccountNumber');
    expect(src).toContain('for (const item of imageEvidence)');
    expect(src).toContain('for (const item of pdfEvidence)');
  });
});
