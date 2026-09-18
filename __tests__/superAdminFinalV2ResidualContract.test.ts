import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const masterCss = source('app/super-admin/super-admin-master-contract.css');
const globalSettings = source('app/super-admin/settings/global/page.tsx');
const activeCompanies = source('app/super-admin/companies/active/page.tsx');
const companyLedger = source('app/super-admin/_components/SuperAdminCompanyStatusLedger.tsx');
const operationalMap = source('app/super-admin/_components/SuperAdminOperationalMap.tsx');

describe('Super Admin current enterprise residual contract', () => {
  it('keeps legacy aliases retired while retaining canonical enterprise tokens', () => {
    expect(masterCss).not.toContain('--sa-master-');
    expect(masterCss).not.toContain('v1 compatibility');
    for (const token of ['--sa-v2-radius: 8px', '--sa-v2-blue: #1A73E8', '--sa-v2-green: #34A853']) {
      expect(masterCss).toContain(token);
    }
  });

  it('keeps the operational map on the canonical enterprise palette', () => {
    for (const token of ['#1A73E8', '#34A853', '#FBBC05', '#EA4335', '#8A9099', '#FFFFFF']) {
      expect(operationalMap).toContain(token);
    }
    expect(operationalMap).toContain('driverOperationalColor');
    expect(operationalMap).toContain('L.polyline');
  });

  it('keeps Global Settings on the governed Platform Owner settings surface', () => {
    expect(globalSettings).toContain('Global Settings');
    expect(globalSettings).toContain('ProtectedRoute');
    expect(globalSettings).toContain("allowedRoles={['owner']}");
    expect(globalSettings).toContain('/api/super-admin/settings');
  });

  it('keeps Active Companies delegated to the canonical company ledger', () => {
    expect(activeCompanies).toContain('SuperAdminCompanyStatusLedger');
    expect(activeCompanies).toContain('mode="active"');
    for (const label of ['Company', 'Registration', 'Email', 'Type', 'Status', 'Created']) {
      expect(companyLedger).toContain(`label:'${label}'`);
    }
  });
});
