import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('XDrive invoice operational detail contract', () => {
  const pdf = read('lib/server/invoicePdf.ts');
  const preview = read('app/api/driver/finance/invoices/[id]/preview/route.ts');
  const submit = read('app/api/driver/finance/invoices/[id]/submit/route.ts');
  const delivery = read('lib/server/invoiceDelivery.ts');
  const webTemplate = read('app/components/InvoiceTemplate.tsx');

  it('keeps issuer-owned identity and human commercial references without platform identifiers', () => {
    expect(pdf).toContain('issuerXdId?: string | null');
    expect(pdf).toContain('customerCompanyNumber?: string | null');
    expect(pdf).toContain('customerXdId?: string | null');
    expect(pdf).toContain('customerReference?: string | null');
    expect(pdf).toContain('loadId?: string | null');
    expect(pdf).toContain("drawLabelValue('Job / load ref'");
    expect(pdf).toContain('Customer Ref.');
    expect(pdf).not.toContain("page.drawText('XDrive ID");
    expect(pdf).not.toContain('app.xdrivelogistics.co.uk');
  });

  it('passes immutable invoice snapshots into preview and canonical sent PDF generation', () => {
    expect(preview).toContain('issuer_xd_id_snapshot');
    expect(preview).toContain('customer_company_number_snapshot');
    expect(preview).toContain('customer_xd_id_snapshot');
    expect(preview).toContain('customer_ref');
    expect(preview).toContain('load_id');
    expect(preview).toContain('ordered_at');
    expect(preview).toContain('left_at');
    expect(preview).toContain('delivery_notes');

    expect(submit).toContain('submitInvoice(request, context)');
    expect(delivery).toContain('loadInvoicePdfContext');
    expect(delivery).toContain('issuerCompanyNumber:');
    expect(delivery).toContain('customerCompanyNumber:');
    expect(delivery).toContain('customerReference:');
    expect(delivery).toContain('loadId:');
  });

  it('retains collection, delivery and payment detail in the professional issuer PDF', () => {
    expect(pdf).toContain("descriptionLines.push(`${pdfText(input.pickupLocation)} -> ${pdfText(input.deliveryLocation)}`)");
    expect(pdf).toContain('Service date:');
    expect(pdf).toContain('Received by:');
    expect(pdf).toContain('Delivery notes:');
    expect(pdf).toContain('PAYMENT DETAILS');
    expect(pdf).toContain('Payment terms:');
    expect(webTemplate).toContain('Proof of Delivery');
    expect(webTemplate).toContain('Payment terms:');
  });
});
