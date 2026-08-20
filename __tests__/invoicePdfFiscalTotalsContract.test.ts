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
    expect(previewRoute).toContain('dueDate: invoice.due_date');
  });

  it('keeps the approved middle-dot separator representable instead of replacing it with question marks', () => {
    expect(source).toContain('\\u00B7');
    expect(source).toContain('\\u00A3\\u00B7\\u20AC');
  });

  it('keeps preview validation enforcing total = net + VAT before PDF generation', () => {
    expect(previewRoute).toContain('Math.abs(totalAmount - (netAmount + vatAmount)) > 0.01');
    expect(previewRoute).toContain('netAmount,');
    expect(previewRoute).toContain('vatAmount,');
    expect(previewRoute).toContain('vatRate,');
    expect(previewRoute).toContain('totalAmount,');
  });
});
