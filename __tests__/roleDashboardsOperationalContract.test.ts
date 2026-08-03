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

  it('maps paid financial state to an allowed token', () => {
    expect(roleDashboardsSource).toContain("{ label: 'Paid', value: money(metrics.paidValue), background: workspaceTheme.surfaceSoft, color: workspaceTheme.green }");
    expect(roleDashboardsSource).not.toContain("{ label: 'Paid', value: money(metrics.paidValue), background: workspaceTheme.surfaceSoft, color: workspaceTheme.purple }");
  });

  it('pins role dashboard typography and interaction states to the operational contract', () => {
    expect(workspaceUiCss).toMatch(/\.roleDashboardSummaryButton\s*\{[\s\S]*font-size:\s*12px;[\s\S]*line-height:\s*16px;[\s\S]*font-weight:\s*600;/);
    expect(workspaceUiCss).toMatch(/\.roleDashboardListRow,\s*\.roleDashboardDriverButton\s*\{[\s\S]*font-size:\s*12px;[\s\S]*line-height:\s*16px;[\s\S]*font-weight:\s*400;/);
    expect(workspaceUiCss).toMatch(/\.roleDashboardDriverName\s*\{[\s\S]*font-size:\s*13px;[\s\S]*line-height:\s*18px;[\s\S]*font-weight:\s*600;/);
    expect(workspaceUiCss).toMatch(/\.roleDashboardSummaryButton:hover,\s*\.roleDashboardDriverButton:hover\s*\{[\s\S]*border-color:\s*#1D57D8;[\s\S]*background:\s*#F1F6FF;/);
    expect(workspaceUiCss).toMatch(/\.roleDashboardSummaryButton:focus-visible,\s*\.roleDashboardDriverButton:focus-visible\s*\{[\s\S]*outline:\s*2px solid #1D57D8;[\s\S]*border-color:\s*#1D57D8;[\s\S]*background:\s*#F1F6FF;/);
  });
});
