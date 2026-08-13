import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canRecordInvoicePayments, PAYMENT_RECORDING_ROLES } from '../lib/financePermissions';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260813094000_invoice_finance_rls_boundary.sql'),
  'utf8',
);

describe('invoice finance authorization boundary', () => {
  it('allows owner/admin/finance and denies dispatcher/Fleet Driver payment recording', () => {
    expect(canRecordInvoicePayments('owner')).toBe(true);
    expect(canRecordInvoicePayments('admin')).toBe(true);
    expect(canRecordInvoicePayments('finance')).toBe(true);
    expect(canRecordInvoicePayments('dispatcher')).toBe(false);
    expect(canRecordInvoicePayments('driver')).toBe(false);
    expect(PAYMENT_RECORDING_ROLES.size).toBe(3);
  });

  it('uses active membership roles and preserves Owner Driver without profile.role checks', () => {
    expect(migration).toContain("lower(coalesce(cm.role_in_company, '')) IN ('owner', 'admin', 'finance')");
    expect(migration).toContain('profile.role is intentionally ignored so Owner Driver remains eligible');
    expect(migration).not.toContain("IN ('owner', 'admin', 'dispatcher', 'finance')");
  });

  it('removes member-wide invoice and line-item write policies', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS invoices_update_member ON public.invoices;');
    expect(migration).toContain('DROP POLICY IF EXISTS invoices_delete_member ON public.invoices;');
    expect(migration).toContain('DROP POLICY IF EXISTS invoice_items_update_member ON public.invoice_items;');
    expect(migration).toContain('DROP POLICY IF EXISTS invoice_items_delete_member ON public.invoice_items;');
    expect(migration).toContain('USING (public.can_edit_invoice(invoice_id));');
  });

  it('keeps explicit bill-to invoice access read-only while issuer finance manages writes', () => {
    expect(migration).toContain('CREATE POLICY invoices_select_finance_boundary_v3');
    expect(migration).toContain('public.can_view_bill_to_company(buyer_company_id)');
    expect(migration).toContain('CREATE POLICY invoices_insert_finance_boundary_v3');
    expect(migration).toContain('CREATE POLICY invoices_update_finance_boundary_v3');
    expect(migration).toContain('public.can_manage_company_finance(company_id)');
  });

  it('removes member-wide payment CRUD and makes invoice payment history append-only', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS invoice_payment_history_member_access ON public.invoice_payment_history;');
    expect(migration).toContain('DROP POLICY IF EXISTS payments_insert_member ON public.payments;');
    expect(migration).toContain('DROP POLICY IF EXISTS payments_update_member ON public.payments;');
    expect(migration).toContain('DROP POLICY IF EXISTS payments_delete_member ON public.payments;');
    expect(migration).toContain('CREATE POLICY invoice_payment_history_insert_finance_boundary_v3');
    expect(migration).not.toContain('CREATE POLICY invoice_payment_history_update_finance_boundary_v3');
    expect(migration).not.toContain('CREATE POLICY invoice_payment_history_delete_finance_boundary_v3');
  });
});
