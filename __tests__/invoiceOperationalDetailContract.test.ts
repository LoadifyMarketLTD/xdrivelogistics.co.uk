import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('XDrive invoice operational detail contract', () => {
  const pdf = read('lib/server/invoicePdf.ts');
  const preview = read('app/api/driver/finance/invoices/[id]/preview/route.ts');
  const submit = read('app/api/driver/finance/invoices/[id]/submit/route.ts');
  const webTemplate = read('app/components/InvoiceTemplate.tsx');

  it('keeps the XDrive invoice structure while exposing identity and reference details', () => {
    expect(pdf).toContain('issuerXdId?: string | null');
    expect(pdf).toContain('customerCompanyNumber?: string | null');
    expect(pdf).toContain('customerXdId?: string | null');
    expect(pdf).toContain('customerReference?: string | null');
    expect(pdf).toContain('loadId?: string | null');
    expect(pdf).toContain('XDrive ID');
    expect(pdf).toContain('Customer Ref:');
    expect(pdf).toContain('JOB / LOAD REF');
  });

  it('passes immutable invoice snapshots into both preview and sent PDF generation', () => {
    for (const route of [preview, submit]) {
      expect(route).toContain('issuer_xd_id_snapshot');
      expect(route).toContain('customer_company_number_snapshot');
      expect(route).toContain('customer_xd_id_snapshot');
      expect(route).toContain('customer_ref');
      expect(route).toContain('load_id');
      expect(route).toContain('ordered_at');
      expect(route).toContain('left_at');
      expect(route).toContain('delivery_notes');
    }
  });

  it('retains collection, delivery and payment detail without adopting the CX layout', () => {
    expect(pdf).toContain("secondLabel: 'Pickup time'");
    expect(pdf).toContain('Ordered ${formatDate(input.orderedAt)}');
    expect(pdf).toContain('Left at:');
    expect(webTemplate).toContain('Proof of Delivery');
    expect(webTemplate).toContain('Payment terms:');
    expect(webTemplate).toContain('Bank details are available from the invoice issuer.');
    expect(webTemplate).toContain('Ordered:');
  });
});
