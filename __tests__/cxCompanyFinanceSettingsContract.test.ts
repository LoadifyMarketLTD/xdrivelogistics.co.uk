import fs from 'node:fs';
import path from 'node:path';

const workspace = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'), 'utf8');
const panel = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyFinanceSettingsPanel.tsx'), 'utf8');
const api = fs.readFileSync(path.join(process.cwd(), 'app/api/settings/company-finance/route.ts'), 'utf8');
const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925034500_company_finance_settings_and_invoice_email.sql'), 'utf8');

describe('CX Company Finance Settings parity', () => {
  it('exposes Bank Details, Invoices and Email Template in Company Settings', () => {
    expect(workspace).toContain('Finance & Invoices');
    for (const label of ['Bank Details', 'Invoice Defaults', 'Invoice Email Template', 'Invoice Email Preview']) expect(panel).toContain(label);
    expect(panel).toContain('Save Finance Settings');
  });

  it('keeps finance mutation at owner/admin boundary', () => {
    expect(api).toContain("adminRoles = new Set(['owner', 'admin'])");
    expect(api).toContain('Company owner or admin access is required for finance settings.');
    expect(migration).toContain('DROP POLICY IF EXISTS company_settings_update_operator');
    expect(migration).toContain('WITH CHECK (public.is_company_admin(company_id))');
  });

  it('enforces canonical payment terms, VAT and complete bank details', () => {
    expect(api).toContain('COMPANY_CONFIG.payment.terms');
    expect(api).toContain('Payment terms must be Pay now, 14 days or 30 days.');
    expect(api).toContain('expectedVatRateForTreatment');
    expect(api).toContain('6-digit sort code and 6-10 digit account number');
    expect(panel).not.toContain('45 days');
    expect(panel).not.toContain('60 days');
  });
});
