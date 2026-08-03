import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const workspaceUiCss = readFileSync(
  new URL('../app/components/workspace/WorkspaceUI.module.css', import.meta.url),
  'utf-8',
);

const dashboardHomeSurfacesDoc = readFileSync(
  new URL('../docs/ui/cx/dashboard-home-surfaces.md', import.meta.url),
  'utf-8',
);

const driverDashboardDoc = readFileSync(
  new URL('../docs/ui/cx/driver-dashboard.md', import.meta.url),
  'utf-8',
);

const driverDashboardVisualGate = readFileSync(
  new URL('../e2e/driver-dashboard-visual-gate.spec.ts', import.meta.url),
  'utf-8',
);

const workspaceVisualGate = readFileSync(
  new URL('../e2e/workspace-visual-auth-gate.spec.ts', import.meta.url),
  'utf-8',
);

describe('Dashboard conformance docs and shared CSS contract', () => {
  it('removes arbitrary rem and proportional line-height values from shared dashboard CSS', () => {
    expect(workspaceUiCss).not.toMatch(/[0-9.]+rem/);
    expect(workspaceUiCss).not.toMatch(/line-height:\s*1\.[0-9]+/);
    expect(workspaceUiCss).toMatch(/\.actionCentreItemTitle\s*\{[\s\S]*font-size:\s*13px;[\s\S]*line-height:\s*18px;[\s\S]*font-weight:\s*600;/);
    expect(workspaceUiCss).toMatch(/\.actionCentreItemDescription\s*\{[\s\S]*font-size:\s*11px;[\s\S]*margin-top:\s*4px;[\s\S]*line-height:\s*14px;/);
    expect(workspaceUiCss).toMatch(/\.actionCentreMeta\s*\{[\s\S]*gap:\s*8px;[\s\S]*margin-top:\s*8px;/);
    expect(workspaceUiCss).toMatch(/\.actionCentreLinkButton,\s*\.actionCentreLinkAnchor\s*\{[\s\S]*font-size:\s*12px;[\s\S]*line-height:\s*16px;[\s\S]*font-weight:\s*600;/);
  });

  it('records route-by-route dashboard measurements with exact table and panel values', () => {
    expect(dashboardHomeSurfacesDoc).toContain('| Panel header height | `36px` minimum |');
    expect(dashboardHomeSurfacesDoc).toContain('| Dense table row target | `38px` |');
    expect(dashboardHomeSurfacesDoc).toContain('| Table row hard maximum | `48px` |');
    expect(dashboardHomeSurfacesDoc).toContain('## Screen-by-screen numerical deviation record');
    expect((dashboardHomeSurfacesDoc.match(/\| PASS \|/g) ?? []).length).toBeGreaterThanOrEqual(18);
    for (const route of ['/admin', '/broker', '/customer', '/driver', 'carrier / fleet', '/super-admin']) {
      expect(dashboardHomeSurfacesDoc).toContain(route);
    }
    for (const viewport of ['1440×900', '768×1024', '390×844']) {
      expect(dashboardHomeSurfacesDoc).toContain(viewport);
    }
    expect(dashboardHomeSurfacesDoc).toContain('must be captured from the authenticated real routes');
    expect(dashboardHomeSurfacesDoc).toContain('/visual-fixture/workspace/[role]');
    expect(dashboardHomeSurfacesDoc).toContain('not accepted as route-proof evidence');
  });

  it('keeps the driver route document and visual gate aligned to the exact numeric assertions', () => {
    expect(driverDashboardDoc).toContain('| Panel header | `36px` minimum |');
    expect(driverDashboardDoc).toContain('| Dense table row | `38px` target |');
    expect(driverDashboardDoc).toContain('| Standard table row | `42px` target / `48px` max |');
    expect(driverDashboardDoc).toContain('rendered validation `31–33px` tolerance');
    expect(driverDashboardDoc).toContain('rendered validation `>= 36px`');
    expect(driverDashboardDoc).toContain('rendered validation `42px target / <=48px max`');
    expect(driverDashboardVisualGate).toContain('toBeGreaterThanOrEqual(31);');
    expect(driverDashboardVisualGate).toContain('toBeLessThanOrEqual(33);');
    expect(driverDashboardVisualGate).toContain('panel header height`).toBeGreaterThanOrEqual(36);');
    expect(driverDashboardVisualGate).toContain('first standard row height`).toBeLessThanOrEqual(48);');
  });

  it('keeps workspace visual proof bound to real routes instead of shared role fixtures', () => {
    expect(workspaceVisualGate).toContain("page.goto(role.route)");
    expect(workspaceVisualGate).toContain("test.skip(!role.email || !role.password");
    expect(workspaceVisualGate).not.toContain('/visual-fixture/workspace/');
  });
});
