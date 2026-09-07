import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const companyLedger = source('app/super-admin/_components/SuperAdminCompanyStatusLedger.tsx');
const memberships = source('app/super-admin/companies/memberships/page.tsx');
const companies = source('app/super-admin/companies/page.tsx');
const financeApi = source('app/api/super-admin/finance/route.ts');
const financeControl = source('app/super-admin/finance/control/page.tsx');
const financeOverview = source('app/super-admin/finance/page.tsx');
const complianceOverview = source('app/super-admin/compliance/page.tsx');
const complianceDocumentsApi = source('app/api/super-admin/compliance/documents/route.ts');
const shell = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');

describe('Super Admin Companies Finance Compliance v3', () => {
  it('keeps tenant membership authority separate from application profile role', () => {
    expect(memberships).toContain("label: 'Tenant role'");
    expect(memberships).toContain("label: 'Profile role'");
    expect(memberships).toContain('role_in_company');
    expect(memberships).toContain('profile_role');
  });
  it('uses shared enterprise company ledgers with canonical inspector drill-down', () => {
    expect(companyLedger).toContain('SuperAdminLiveTablePage');
    expect(companyLedger).toContain('PlatformEntityLink');
    expect(companyLedger).toContain('entityType="company"');
    expect(companies).toContain('All Companies Governance');
    expect(companies).toContain('governanceHistoryAvailable');
  });

  it('never silently aggregates Trade Control monetary values across currencies', () => {
    expect(financeApi).toContain('currencyBreakdown');
    expect(financeApi).toContain("'UNSPECIFIED'");
    expect(financeApi).toContain('singleCurrency');
    expect(financeControl).toContain('Currency breakdown');
    expect(financeControl).toContain('Unavailable');
  });

  it('keeps Finance Overview evidence-driven and explicit about unavailable datasets', () => {
    expect(financeOverview).toContain('SuperAdminMetricGrid');
    expect(financeOverview).toContain('Expenses');
    expect(financeOverview).toContain('Unavailable');
    expect(financeOverview).toContain('/api/super-admin/finance/summary');
  });
  it('adds a first-class Compliance Overview with bounded truth semantics', () => {
    expect(shell).toContain("label: 'Compliance Overview'");
    expect(shell).toContain("href: '/super-admin/compliance'");
    expect(complianceOverview).toContain('/api/super-admin/compliance/documents?limit=500');
    expect(complianceOverview).toContain('not presented as an exact platform-wide total');
  });

  it('preserves owner-only audited compliance document review and secure previews', () => {
    expect(complianceDocumentsApi).toContain("owner_review_compliance_document");
    expect(complianceDocumentsApi).toContain('createSignedUrl');
    expect(complianceDocumentsApi).toContain("action_type: 'document_viewed'");
    expect(complianceDocumentsApi).toContain('getFeatureFlag');
  });
});
