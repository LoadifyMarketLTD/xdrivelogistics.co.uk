import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const driverDashboardSource = readFileSync(
  new URL('../app/driver/page.tsx', import.meta.url),
  'utf-8',
);

const workspaceUiCss = readFileSync(
  new URL('../app/components/workspace/WorkspaceUI.module.css', import.meta.url),
  'utf-8',
);

describe('Driver dashboard operational contract', () => {
  it('removes route-local inline styles and banned legacy color literals from the driver home surface', () => {
    expect(driverDashboardSource).not.toContain('style={{');
    expect(driverDashboardSource).not.toContain('#202124');
    expect(driverDashboardSource).not.toContain('#eef2f6');
    expect(driverDashboardSource).not.toContain('#d9e2ec');
    expect(driverDashboardSource).not.toContain('#0f172a');
    expect(driverDashboardSource).not.toContain('#64748b');
  });

  it('uses shared compact primitives for the driver control desk and summaries', () => {
    expect(driverDashboardSource).toContain('<OperationalMetricList');
    expect(driverDashboardSource).toContain('className={styles.roleDashboardSummaryList}');
    expect(driverDashboardSource).toContain('className={styles.roleDashboardSummaryButton}');
    expect(driverDashboardSource).toContain('className={styles.roleDashboardColumn}');
    expect(driverDashboardSource).toContain('className={styles.roleDashboardListRow}');
  });

  it('pins the driver home surface typography to explicit operational classes', () => {
    expect(workspaceUiCss).toMatch(/\.driverDashboardRoute\s*\{[\s\S]*font-size:\s*13px;[\s\S]*line-height:\s*18px;[\s\S]*font-weight:\s*600;/);
    expect(workspaceUiCss).toMatch(/\.driverDashboardMeta\s*\{[\s\S]*margin-top:\s*4px;[\s\S]*font-size:\s*11px;[\s\S]*line-height:\s*14px;/);
    expect(workspaceUiCss).toMatch(/\.driverDashboardCurrentJob\s*\{[\s\S]*gap:\s*8px;/);
    expect(workspaceUiCss).toMatch(/\.driverDashboardAlertAction\s*\{[\s\S]*margin-top:\s*8px;/);
  });

  it('uses allowed dashboard tones for owner-driver quote summaries', () => {
    expect(driverDashboardSource).toContain('const BID_STATUS_TONE: Record<string, \'green\' | \'orange\' | \'red\' | \'grey\'> = {');
    expect(driverDashboardSource).toContain("withdrawn: 'grey'");
    expect(driverDashboardSource).toContain("label: 'Quotes submitted'");
    expect(driverDashboardSource).toContain("tone: 'blue' as const");
    expect(driverDashboardSource).not.toContain("withdrawn: 'purple'");
    expect(driverDashboardSource).not.toContain('tone="purple"');
  });

  it('caps the owner-driver KPI strip at six visible tiles and moves lower-priority finance metrics into summaries', () => {
    const dashboardKpiConfigMatch = driverDashboardSource.match(/const dashboardKpis:[\s\S]*?=\s*\[([\s\S]*?)\n\s*\];/);
    expect(dashboardKpiConfigMatch).toBeTruthy();
    const dashboardKpiConfigSource = dashboardKpiConfigMatch?.[1] ?? '';
    expect((dashboardKpiConfigSource.match(/label:\s*'/g) ?? []).length).toBe(6);
    expect(dashboardKpiConfigSource).toContain("label: 'Quotes submitted'");
    expect(dashboardKpiConfigSource).not.toContain("label: 'Won work'");
    expect(dashboardKpiConfigSource).not.toContain("label: 'Pending invoices'");
    expect(driverDashboardSource).toContain("['Won work (accepted)', wonWork, '/driver/won-work']");
    expect(driverDashboardSource).toContain("['Pending invoices', pendingInvoices, '/driver/finance']");
  });
});
