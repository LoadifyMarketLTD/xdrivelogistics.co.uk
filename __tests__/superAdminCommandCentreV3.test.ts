import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const page = source('app/super-admin/page.tsx');
const css = source('app/super-admin/CommandCentreV3.module.css');
const commandApi = source('app/api/super-admin/command-centre/route.ts');
const statsApi = source('app/api/super-admin/stats/route.ts');
const operationsApi = source('app/api/super-admin/operations-cockpit/route.ts');

describe('MASTER CONTRACT FINAL v3 — Command Centre', () => {
  it('uses exactly eight primary platform-control KPI labels', () => {
    const labels = [
      'Active Jobs', 'Jobs at Risk', 'Drivers Online', 'Fleet readiness',
      'Compliance review', 'Outstanding invoices', 'Active companies', 'Critical actions',
    ];
    for (const label of labels) expect(page).toContain(`'${label}'`);
    expect(page).toContain('data-contract-surface="command-centre-kpis"');
    expect(page).toContain('Eight primary signals only.');
  });
  it('loads only canonical owner-verified read models for the overview', () => {
    expect(page).toContain("getAuthHeader");
    expect(page).toContain("'/api/super-admin/command-centre'");
    expect(page).toContain("'/api/super-admin/stats'");
    expect(page).toContain("'/api/super-admin/operations-cockpit'");
    expect(page).not.toContain('supabase.auth.getSession');
    expect(page).not.toContain('supabaseClient');
    for (const api of [commandApi, statsApi, operationsApi]) {
      expect(api).toContain('verifyPlatformOwner');
    }
  });

  it('keeps unavailable and partial source states explicit', () => {
    expect(page).toContain('kpi-unavailable');
    expect(page).toContain('missing sources are never interpreted as zero or healthy');
    expect(page).toContain('A platform-wide zero has not been established.');
    expect(commandApi).toContain('queueCoverageUnavailable');
    expect(commandApi).toContain('count: null');
  });
  it('uses the real operational map only when source-backed positions exist', () => {
    expect(page).toContain('SuperAdminOperationalMap');
    expect(page).toContain('operations.map.drivers.length > 0 || operations.map.jobs.length > 0');
    expect(page).toContain('No placeholder pins are shown.');
    expect(page).toContain('Accessible live-position ledger');
    expect(operationsApi).toContain("driver_availability_presence");
    expect(operationsApi).toContain("driver_locations");
  });

  it('keeps financial truth explicit instead of inventing a mixed-currency total', () => {
    expect(page).toContain('Mixed currencies — aggregate suppressed.');
    expect(operationsApi).toContain('mixedCurrency: financeCurrency === null');
    expect(operationsApi).toContain('revenueToday: financeCurrency ? sumPayments(dayStart) : null');
  });

  it('keeps the Command Centre responsive and XDrive-native', () => {
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 620px)');
    expect(page).not.toContain('CargoMax');
    expect(page).not.toContain('ShipNow');
  });
});
