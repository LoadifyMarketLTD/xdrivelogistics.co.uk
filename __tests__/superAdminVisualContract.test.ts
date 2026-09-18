import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const layout = source('app/super-admin/layout.tsx');
const lightCss = source('app/super-admin/super-admin-light.css');
const hardeningCss = source('app/super-admin/super-admin-light-hardening.css');
const visualCss = source('app/super-admin/super-admin-visual-contract.css');
const shellCss = source('app/super-admin/_components/SuperAdminCardNavigationShell.module.css');
const workspace = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');
const commandCentre = source('app/super-admin/page.tsx');
const allJobs = source('app/super-admin/operations/jobs/page.tsx');
const jobLedger = source('app/super-admin/_components/SuperAdminOperationsJobLedger.tsx');
const activeCompanies = source('app/super-admin/companies/active/page.tsx');
const companyLedger = source('app/super-admin/_components/SuperAdminCompanyStatusLedger.tsx');
const finance = source('app/super-admin/finance/page.tsx');

describe('Super Admin current visual/source compliance', () => {
  it('loads only the active light-theme visual layers', () => {
    expect(layout).toContain("import './super-admin-light.css'");
    expect(layout).toContain("import './super-admin-light-hardening.css'");
    expect(layout).toContain("import './super-admin-visual-contract.css'");
    expect(layout).not.toContain("import './super-admin-master-contract.css'");
    expect(layout).not.toContain("import './super-admin-v2-icon-enforcement.css'");
  });

  it('keeps approved enterprise light surfaces and controls', () => {
    expect(lightCss).toContain('.super-admin-light-root');
    expect(hardeningCss).toContain('.super-admin-light-root .sa-button');
    expect(hardeningCss).toContain('border: 1px solid #E0E3E7');
    expect(hardeningCss).toContain('color: #1A73E8');
    expect(visualCss).toContain('--enterprise-button-padding: 12px 18px');
  });

  it('keeps navigation responsive on tablet and mobile', () => {
    expect(shellCss).toContain('@media (max-width: 1200px)');
    expect(shellCss).toContain('@media (max-width: 900px)');
    expect(shellCss).toContain('@media (max-width: 640px)');
    expect(shellCss).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('keeps Command Centre fail-closed rather than fabricating healthy zeroes', () => {
    expect(commandCentre).toContain('Unavailable — not reported as healthy.');
    expect(commandCentre).toContain('No zero or healthy state has been inferred.');
    expect(commandCentre).toContain('Critical attention');
    expect(commandCentre).toContain('Operational queue');
  });

  it('keeps All Jobs on the canonical shared ledger', () => {
    expect(allJobs).toContain('SuperAdminOperationsJobLedger');
    expect(allJobs).toContain('mode="all"');
    for (const label of ['Route', 'Status', 'Posting company', 'Bids']) {
      expect(jobLedger).toContain(`label: '${label}'`);
    }
    expect(jobLedger).toContain("label: mode === 'pending' ? 'Posted' : 'Created'");
  });

  it('keeps Active Companies on the canonical shared ledger', () => {
    expect(activeCompanies).toContain('SuperAdminCompanyStatusLedger');
    expect(activeCompanies).toContain('mode="active"');
    for (const label of ['Company', 'Registration', 'Email', 'Type', 'Status', 'Created']) {
      expect(companyLedger).toContain(`label:'${label}'`);
    }
  });

  it('keeps Finance evidence-backed and unavailable-aware', () => {
    expect(finance).toContain('Finance Overview');
    expect(finance).toContain('No authoritative platform expense ledger');
    expect(finance).toContain('Cannot infer profit without expenses');
    expect(finance).toContain('Top Clients remains unavailable');
  });

  it('keeps the current governed Platform navigation visible', () => {
    for (const label of [
      'Users & Access', 'Roles & Permissions', 'Notifications', 'Platform Health',
      'Audit Logs', 'Global Settings', 'Legal & Agreements', 'Feature Flags',
    ]) expect(workspace).toContain(`label: '${label}'`);
  });
});
