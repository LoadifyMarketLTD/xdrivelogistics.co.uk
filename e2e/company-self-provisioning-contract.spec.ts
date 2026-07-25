import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const adminCompaniesPage = readFileSync(
  resolve(process.cwd(), 'app/admin/companies/page.tsx'),
  'utf8'
);

const companyAction = readFileSync(
  resolve(process.cwd(), 'app/actions/companies.ts'),
  'utf8'
);

test.describe('company self-provisioning contract', () => {
  test('admin companies page no longer performs direct client-side company inserts', () => {
    expect(adminCompaniesPage).not.toContain(".from('companies').insert");
    expect(adminCompaniesPage).not.toContain(".from('company_memberships').upsert");
    expect(adminCompaniesPage).toContain('Direct company creation is disabled.');
  });

  test('verified company registration remains server-side and token-verified', () => {
    expect(companyAction).toContain('registerValidatedCompany');
    expect(companyAction).toContain('supabaseAdmin.auth.getUser(accessToken)');
    expect(companyAction).toContain("['broker_shipper', 'fleet_courier'].includes(application.account_type)");
  });
});
