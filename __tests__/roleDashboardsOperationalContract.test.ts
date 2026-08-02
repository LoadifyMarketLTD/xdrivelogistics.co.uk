import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const roleDashboardsSource = readFileSync(
  new URL('../app/components/workspace/RoleDashboards.tsx', import.meta.url),
  'utf-8',
);

const workspaceUiCss = readFileSync(
  new URL('../app/components/workspace/WorkspaceUI.module.css', import.meta.url),
  'utf-8',
);

describe('Role dashboard operational contract', () => {
  it('keeps static dashboard layout styles in CSS modules', () => {
    expect(roleDashboardsSource).not.toContain('style={{');
    expect(roleDashboardsSource).not.toContain('dashboardColumnStyle');
    expect(roleDashboardsSource).not.toContain('summaryButtonStyle');
    expect(roleDashboardsSource).not.toContain('RailMetricList');
    expect(roleDashboardsSource).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
    expect(roleDashboardsSource).not.toContain('transparent');
  });

  it('defines CSS module classes for dashboard summary and driver rows', () => {
    expect(workspaceUiCss).toContain('.roleDashboardColumn');
    expect(workspaceUiCss).toContain('.roleDashboardSummaryButton');
    expect(workspaceUiCss).toContain('.roleDashboardListRow');
    expect(workspaceUiCss).toContain('.roleDashboardDriverButton');
    expect(workspaceUiCss).toContain('.roleDashboardDriverMeta');
  });

  it('uses the exact panel title and metadata typography tokens', () => {
    expect(workspaceUiCss).toMatch(/\.operationalCardTitle\s*\{[\s\S]*font-size:\s*13px;[\s\S]*line-height:\s*18px;/);
    expect(workspaceUiCss).toMatch(/\.operationalCardSubtitle\s*\{[\s\S]*font-size:\s*11px;[\s\S]*line-height:\s*14px;/);
  });
});
