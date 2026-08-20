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

const invoiceVat = readFileSync(
  resolve(process.cwd(), 'lib/invoiceVat.ts'),
  'utf8',
);

describe('Invoice PDF fiscal totals contract', () => {
  it('renders the issuer company number when supplied', () => {
    expect(source).toContain('if (input.issuerCompanyNumber)');
    expect(source).toContain('Company No. ${pdfText(input.issuerCompanyNumber');
    expect(previewRoute).toContain('issuerCompanyNumber: company.company_number');
  });

  it('renders net, VAT rate/amount and the existing payable total from canonical numeric fields', () => {
    expect(source).toContain("page.drawText('Net:'");
    expect(source).toContain('money(finiteMoney(input.netAmount), input.currency)');
    expect(source).toContain('VAT ${finiteMoney(input.vatRate)}%:');
    expect(source).toContain('money(finiteMoney(input.vatAmount), input.currency)');
    expect(source).toContain('money(finiteMoney(input.totalAmount), input.currency)');
  });

  it('renders the calculated due date and keeps the late-payment notice separate', () => {
    expect(source).toContain('Due date: ${formatDate(input.dueDate)}');
    expect(source).toContain("page.drawText('Late payments may incur administrative charges.'");
    expect(previewRoute).toContain('dueDate: cleanText(invoice.due_date');
  });

  it('keeps the approved middle-dot separator representable instead of replacing it with question marks', () => {
    expect(source).toContain('\\u00B7');
    expect(source).toContain('\\u00A3\\u00B7\\u20AC');
  });

  it('keeps preview and submit validation delegated to the canonical VAT-treatment totals contract', () => {
    for (const route of [previewRoute, submitRoute]) {
      expect(route).toContain('validateInvoiceVatTotals({');
      expect(route).toContain('netAmount,');
      expect(route).toContain('vatAmount,');
      expect(route).toContain('vatRate,');
      expect(route).toContain('totalAmount,');
      expect(route).toContain('treatment: vatTreatment');
    }

    expect(submitRoute).not.toContain('Math.abs(totalAmount - (netAmount + vatAmount)) > 0.01');
    expect(submitRoute).toContain('vatTreatment,');
    expect(submitRoute).toContain('customerVatNumber: customerVatNumber || null');
    expect(submitRoute).toContain('issuerVatNumber: issuerVatNumber || null');

    // The canonical helper validates both ordinary VAT invoices and reverse-charge
    // invoices, where VAT is disclosed but is not added to the amount payable.
    expect(invoiceVat).toContain('if (Math.abs(vatAmount - expectedVat) > 0.01) return false;');
    expect(invoiceVat).toContain("const expectedTotal = treatment === 'reverse_charge'");
    expect(invoiceVat).toContain('return Math.abs(totalAmount - expectedTotal) <= 0.01;');
  });
});
