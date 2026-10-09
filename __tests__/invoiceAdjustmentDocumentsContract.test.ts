import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Supplementary invoice and credit note completion', () => {
  const schema = read('supabase/migrations/20261009204500_invoice_adjustment_documents.sql');
  const integrity = read('supabase/migrations/20261009205500_invoice_adjustment_integrity.sql');
  const adjustmentApi = read('app/api/admin/invoices/[id]/adjustments/route.ts');
  const lifecycleApi = read('app/api/admin/invoices/[id]/lifecycle/route.ts');
  const adminDetail = read('app/admin/invoices/[id]/page.tsx');
  const driverDetail = read('app/driver/finance/invoices/[id]/page.tsx');
  const register = read('app/components/workspace/InvoiceRegisterPage.tsx');
  const template = read('app/components/InvoiceTemplate.tsx');
  const customerApi = read('app/api/finance/invoices/[id]/route.ts');

  it('uses first-class adjustment document fields instead of overloading disputes', () => {
    expect(schema).toContain("document_type text not null default 'invoice'");
    expect(schema).toContain("'supplementary','credit_note'");
    expect(schema).toContain('parent_invoice_id');
    expect(integrity).toContain('invoices_adjustment_parent_contract');
    expect(lifecycleApi).toContain('Credit notes are financial adjustment documents, not disputes.');
    expect(lifecycleApi).not.toContain("reason: 'Credit note requested'");
  });

  it('creates authorised supplementary invoices and credit notes as separate linked financial documents', () => {
    expect(adjustmentApi).toContain("z.enum(['supplementary', 'credit_note'])");
    expect(adjustmentApi).toContain("anyOf: ['invoices.customer.manage', 'invoices.carrier.manage']");
    expect(adjustmentApi).toContain('created_by: finance.userId');
    expect(adjustmentApi).toContain("document_type: parsed.data.documentType");
    expect(adjustmentApi).toContain('parent_invoice_id: source.id');
    expect(adjustmentApi).toContain('adjustment_reason: parsed.data.reason');
    expect(adjustmentApi).toContain('Credit note exceeds the remaining creditable amount');
    expect(adjustmentApi).toContain('Invoice adjustments can only be created from an issued invoice document.');
  });

  it('exposes adjustment actions in both company finance and Owner Driver finance without rebuilding invoice flows', () => {
    for (const source of [adminDetail, driverDetail]) {
      expect(source).toContain('Supplementary / Credit Note');
      expect(source).toContain('/adjustments');
      expect(source).toContain('Create invoice adjustment');
      expect(source).toContain("adjustmentType === 'credit_note'");
    }
  });

  it('renders and accounts credit notes as negative values while keeping stored document amounts positive', () => {
    expect(register).toContain('invoiceSignedGrossAmount');
    expect(register).toContain("invoice.document_type === 'credit_note'");
    expect(template).toContain("invoice.documentType === 'credit_note' ? -Math.abs(invoice.amount)");
    expect(template).toContain('CREDIT NOTE');
    expect(template).toContain('SUPPLEMENTARY INVOICE');
  });

  it('keeps document classification visible to customer-safe invoice reads', () => {
    expect(customerApi).toContain('document_type: invoice.document_type');
    expect(customerApi).toContain('parent_invoice_id: invoice.parent_invoice_id');
    expect(customerApi).toContain('adjustment_reason: invoice.adjustment_reason');
  });
});
