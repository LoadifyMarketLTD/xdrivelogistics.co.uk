import fs from 'node:fs';
import path from 'node:path';

describe('CX workspace responsive convergence', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('stacks shared operational dashboards and control grids by tablet width', () => {
    const css = read('app/components/workspace/OperationalConvergence.module.css');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(baseline).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.xdrive-owner-dashboard-grid[\s\S]*?grid-template-columns:\s*1fr/);
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.controlGrid[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.signalStrip[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it('keeps shared header actions right-aligned through the 1025-1280px breakpoint', () => {
    const css = read('app/components/workspace/top-workspace-shell.css');
    const midWidth = css.split('@media (max-width: 1280px) {')[1]?.split('\n}')[0] ?? '';
    expect(midWidth).toContain('grid-template-columns: minmax(160px, 1fr) auto !important;');
    expect(midWidth).not.toContain('minmax(190px, auto) minmax(0, 1fr) auto');
  });

  it('uses one responsive record geometry for Loads, Jobs and cross-role operational rows', () => {
    const css = read('app/components/workspace/workspace-measured-cx-baseline.css');
    const tablet = css.split('@media (max-width: 1200px) {')[1]?.split('\n}')[0] ?? '';
    const mobile = css.split('@media (max-width: 768px) {').at(-1) ?? '';
    for (const hook of ['.driver-load-row__top', '.driver-job-row__top', '.workspace-operational-row__top']) {
      expect(tablet).toContain(hook);
      expect(mobile).toContain(hook);
    }
    expect(tablet).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
    expect(mobile).toContain('grid-template-columns: 1fr !important;');
    expect(mobile).toContain('.driver-job-cell');
    expect(mobile).toContain('border-right: 0 !important;');

    // The common baseline owns terminal dividers at desktop, tablet and phone widths.
    // The old Driver-only :last-child rule lost to the shared !important border.
    for (const cell of ['driver-load-cell', 'driver-job-cell', 'workspace-operational-cell']) {
      expect(css).toContain(`.xdrive-workspace-measured .${cell}:last-child`);
      expect(css).toContain(`.xdrive-workspace-measured .${cell}:nth-child(2n)`);
    }
    expect(read('app/driver/driver-operational.css')).not.toContain('.driver-load-cell:last-child');
  });

  it('keeps customer responsive ownership on shared KPI primitives while stacking activity cards locally', () => {
    const css = read('app/customer/customer-dashboard.css');
    const uiCss = read('app/components/workspace/WorkspaceUI.module.css');
    const dashboard = read('app/customer/CustomerDashboardHome.tsx');
    expect(dashboard).toContain('<KpiGrid>');
    expect(css).not.toContain('.customer-owner-stat-grid');
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.customer-activity-card__main \{ grid-template-columns: 1fr; \}/);
    expect(uiCss).toContain('.exchangeKpiStrip');
    expect(uiCss).toContain('grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));');
  });

  it('keeps Broker on the shared Owner Driver responsive grid without a bespoke control-grid adapter', () => {
    const css = read('app/broker/broker-dashboard-convergence.css');
    const dashboard = read('app/broker/BrokerDashboardHome.tsx');
    expect(dashboard).toContain('xdrive-owner-dashboard-grid');
    expect(css).not.toContain('.xdrive-broker-control-grid');
  });

  it('stacks real Driver Availability and Account without duplicating route-owned tablet rules', () => {
    const css = read('app/driver/driver-prototype-parity.css');
    const tablet = css.split('/* Availability and Account have important desktop columns')[1]?.split('@media (max-width: 768px)')[0] ?? '';
    expect(tablet).toContain('@media (max-width: 1024px)');
    for (const selector of [
      '.driver-reference-availability .driver-availability-board',
      '.driver-account-workspace',
    ]) expect(tablet).toContain(selector);
    expect(tablet).toContain('grid-template-columns: minmax(0, 1fr) !important;');
    expect(tablet).toContain('.driver-account-section-nav');
    expect(tablet).toContain('position: static !important;');

    const returnsCss = read('app/driver/returns/returns-exchange.css');
    expect(returnsCss).toMatch(/@media \(max-width: 1024px\) \{[\s\S]*?\.driver-returns-board,[\s\S]*?\.driver-returns-add-board \{ grid-template-columns: 1fr; \}/);
    const diaryCss = read('app/driver/driver-full-prototype.css');
    expect(diaryCss).toMatch(/@media\(max-width:1024px\)\{[\s\S]*?\.driver-diary-board\.diary-pagebody>\.driver-board-main\{[\s\S]*?grid-column:1!important/);
  });

  it('stacks Fleet Allocation and all measured TwoColumn panels at tablet widths without a fixed-width left track', () => {
    const route = read('app/admin/fleet/assignments/page.tsx');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(route).toContain('<TwoColumn rightWidth="minmax(0, 1.2fr)">');
    expect(route).not.toContain("gridTemplateColumns: 'minmax(220px, .8fr)");
    const tablet = baseline.split('@media (max-width: 1024px) {')[1]?.split('\n}')[0] ?? '';
    expect(tablet).toContain('.xdrive-workspace-measured .xdrive-two-column');
    expect(tablet).toContain('grid-template-columns: minmax(0, 1fr) !important;');
  });

  it('returns the shared Owner Driver dashboard grid to a single-column layout by tablet width', () => {
    const css = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(css).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.xdrive-owner-dashboard-grid[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.xdrive-owner-dashboard-subgrid[\s\S]*?grid-template-columns:\s*1fr;/);
  });
});
