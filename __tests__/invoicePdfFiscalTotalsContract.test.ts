import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'lib/server/invoicePdf.ts'),
  'utf8',
);

const previewRoute = readFileSync(
  resolve(process.cwd(), 'app/api/driver/finance/invoices/[id]/preview/route.ts'),
  'utf8',
);

const submitRoute = readFileSync(
  resolve(process.cwd(), 'app/api/driver/finance/invoices/[id]/submit/route.ts'),
  'utf8',
);

const invoiceDelivery = readFileSync(
  resolve(process.cwd(), 'lib/server/invoiceDelivery.ts'),
  'utf8',
);

const invoiceVat = readFileSync(
  resolve(process.cwd(), 'lib/invoiceVat.ts'),
  'utf8',
);

describe('Invoice PDF fiscal totals contract', () => {
  it('renders the issuer company number when supplied', () => {
    expect(source).toContain('input.issuerCompanyNumber ?');
    expect(source).toContain('Company No. ${pdfText(input.issuerCompanyNumber)');
    expect(previewRoute).toContain('issuerCompanyNumber: cleanText(invoice.issuer_company_number_snapshot) || company.company_number');
  });

  it('renders subtotal, VAT treatment and payable total from canonical numeric fields', () => {
    expect(source).toContain("amountRow('Subtotal'");
    expect(source).toContain('money(finiteMoney(input.netAmount), input.currency)');
    expect(source).toContain("const vatLabel = vatTreatment === 'not_registered'");
    expect(source).toContain('money(finiteMoney(input.vatAmount), input.currency)');
    expect(source).toContain("amountRow('TOTAL DUE', totalValue");
    expect(source).toContain('money(finiteMoney(input.totalAmount), input.currency)');
  });

  it('renders the canonical due date without injecting unrelated platform notices', () => {
    expect(source).toContain('Due date: ${formatDate(input.dueDate)}');
    expect(previewRoute).toContain('dueDate: cleanText(invoice.due_date');
    expect(source).not.toContain('Late payments may incur administrative charges.');
  });

  it('keeps the approved middle-dot separator representable instead of replacing it with question marks', () => {
    expect(source).toContain('\\u00B7');
    expect(source).toContain('\\u00A3\\u00B7\\u20AC');
  });

  it('keeps preview and canonical delivery validation delegated to the VAT-treatment totals contract', () => {
    for (const implementation of [previewRoute, invoiceDelivery]) {
      expect(implementation).toContain('validateInvoiceVatTotals({');
      expect(implementation).toContain('netAmount,');
      expect(implementation).toContain('vatAmount,');
      expect(implementation).toContain('vatRate,');
      expect(implementation).toContain('totalAmount,');
      expect(implementation).toContain('treatment: vatTreatment');
    }

    expect(submitRoute).toContain('submitInvoice(request, context)');
    expect(invoiceDelivery).not.toContain('Math.abs(totalAmount - (netAmount + vatAmount)) > 0.01');
    expect(invoiceDelivery).toContain('vatTreatment,');
    expect(invoiceDelivery).toContain('customerVatNumber: customerVatNumber || null');
    expect(invoiceDelivery).toContain('issuerVatNumber: issuerVatNumber || null');

    expect(invoiceVat).toContain('if (Math.abs(vatAmount - expectedVat) > 0.01) return false;');
    expect(invoiceVat).toContain("const expectedTotal = treatment === 'reverse_charge'");
    expect(invoiceVat).toContain('return Math.abs(totalAmount - expectedTotal) <= 0.01;');
  });

  it('wraps long service descriptions by measured PDF width before the price columns', () => {
    expect(source).toContain('const wrapTextToWidth = (');
    expect(source).toContain('font.widthOfTextAtSize(next, size) <= maxWidth');
    expect(source).toContain('const serviceTitleLines = wrapTextToWidth(');
    expect(source).toContain('descW - 22');
    expect(source).toContain('let descY = tableTop - 46 - serviceTitleLines.length * 12 - 5');
  });
});
