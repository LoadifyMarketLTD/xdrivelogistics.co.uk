import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildInvoicePdf } from '../lib/server/invoicePdf';

const source = readFileSync(resolve(process.cwd(), 'lib/server/invoicePdf.ts'), 'utf8');
const previewRoute = readFileSync(resolve(process.cwd(), 'app/api/driver/finance/invoices/[id]/preview/route.ts'), 'utf8');
const submitRoute = readFileSync(resolve(process.cwd(), 'app/api/driver/finance/invoices/[id]/submit/route.ts'), 'utf8');
const invoiceDelivery = readFileSync(resolve(process.cwd(), 'lib/server/invoiceDelivery.ts'), 'utf8');
const invoiceVat = readFileSync(resolve(process.cwd(), 'lib/invoiceVat.ts'), 'utf8');

describe('Invoice PDF fiscal totals and layout contract', () => {
  it('renders real issuer company number from the invoice snapshot', () => {
    expect(source).toContain('input.issuerCompanyNumber');
    expect(source).toContain("'Company No. '+pdfText(input.issuerCompanyNumber)");
    expect(previewRoute).toContain('issuerCompanyNumber: cleanText(invoice.issuer_company_number_snapshot) || company.company_number');
  });

  it('keeps subtotal, VAT treatment and payable total tied to canonical numeric input', () => {
    expect(source).toContain("moneyRow('Subtotal',money(finiteMoney(input.netAmount),input.currency)");
    expect(source).toContain("const vatLabel=vatTreatment==='not_registered'");
    expect(source).toContain('money(finiteMoney(input.vatAmount),input.currency)');
    expect(source).toContain("fit('TOTAL DUE'");
    expect(source).toContain('money(finiteMoney(input.totalAmount),input.currency)');
  });

  it('uses the stored due date without invented legal charges', () => {
    expect(source).toMatch(/\['DUE DATE',\s*formatDate\(input\.dueDate\)\]/);
    expect(previewRoute).toContain('dueDate: cleanText(invoice.due_date');
    expect(source).not.toContain('Late payments may incur administrative charges.');
  });

  it('preserves currency, punctuation and middle-dot support', () => {
    expect(source).toContain('\\u00B7');
    expect(source).toContain('\\u00A3\\u00B7\\u20AC');
  });

  it('validates VAT arithmetic for previews and sent invoices before building PDFs', () => {
    for(const implementation of [previewRoute,invoiceDelivery]){
      for(const field of ['validateInvoiceVatTotals({','netAmount,','vatAmount,','vatRate,','totalAmount,','treatment: vatTreatment']){
        expect(implementation).toContain(field);
      }
    }
    expect(submitRoute).toContain('submitInvoice(request, context)');
    expect(invoiceDelivery).toContain('vatTreatment,');
    expect(invoiceDelivery).toContain('customerVatNumber: customerVatNumber || null');
    expect(invoiceDelivery).toContain('issuerVatNumber: issuerVatNumber || null');
    expect(invoiceVat).toContain('if (Math.abs(vatAmount - expectedVat) > 0.01) return false;');
    expect(invoiceVat).toContain("const expectedTotal = treatment === 'reverse_charge'");
    expect(invoiceVat).toContain('return Math.abs(totalAmount - expectedTotal) <= 0.01;');
  });

  it('wraps long transport descriptions within the amount column and generates a valid A4 invoice', async () => {
    expect(source).toContain('const serviceTitleLines = wrapTextToWidth(');
    expect(source).toContain('serviceTitleLines.forEach');
    expect(source).toContain('310, 10, 2');
    expect(source).toContain('const detailStartY = tableTop - 77 - (serviceTitleLines.length - 1) * 11');
    const pdf=await PDFDocument.load(await buildInvoicePdf({
      invoiceNumber:'INV-TEST-LONG',invoiceDate:'2026-11-09',dueDate:'2026-11-30',
      issuerName:'XDrive Carrier',issuerCompanyNumber:'12345678',
      clientName:'Test customer',serviceDescription:'Luton Tail Lift Long Distance Transport Including Fragile High Value Multi Pallet Cargo With Carefully Coordinated Collection And Delivery Requirements',
      netAmount:80,vatAmount:16,vatRate:20,vatTreatment:'standard',
      totalAmount:96,currency:'GBP',paymentTerms:'End of calendar month',
    }));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.28,1);
  });
});
