import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('live Driver approved prototype parity contract', () => {
  it('uses the unified operational shell with Driver and Owner Driver modules', () => {
    const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
    const roles = read('lib/workspaceRole.ts');
    const layout = read('app/driver/layout.tsx');
    for (const label of ['My Jobs','Diary','Availability','Vehicle','Directory','Return Journeys','Loads','Quotes','Won Work','Auto-match & Alerts','Freight Vision','Invoices']) {
      expect(roles).toContain(`label: '${label}'`);
    }
    expect(shell).toContain('top-workspace-nav top-workspace-nav--primary');
    expect(shell).toContain('composeDriverPrimaryNav');
    expect(layout).toContain("import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell'");
    expect(layout).toContain('<TopWorkspaceShell>{children}</TopWorkspaceShell>');
    expect(layout).not.toContain('main-nav');
  });

  it('keeps the Driver page styles loaded for dense operational content', () => {
    const layout = read('app/driver/layout.tsx');
    expect(layout).toContain("driver-full-prototype.css");
    expect(layout).toContain("driver-dashboard-prototype-exact.css");
  });

  it('keeps the dashboard as a compact operational register, not a SaaS card wall', () => {
    const page = read('app/driver/page.tsx');
    for (const marker of ['driver-dashboard-statusbar','driver-dashboard-register','driver-dashboard-readiness','Current assignment','Next booking']) {
      expect(page).toContain(marker);
    }
    for (const removed of ['xd2-hero','xd2-kpis','xd2-primary-grid','xd2-secondary-grid','xd2-finance','xd2-bottom-grid']) {
      expect(page).not.toContain(removed);
    }
  });

  it('uses prototype page chrome for non-account Driver routes', () => {
    const shell = read('app/driver/_components/DriverWorkspaceShell.tsx');
    expect(shell).toContain('driver-prototype-page-shell');
    expect(shell).toContain('className="subbar"');
    expect(shell).toContain('className="pagebody no-left"');
    expect(shell).toContain('className="main"');
  });

  it('keeps Company workspace files out of the Driver page styles', () => {
    const css = read('app/driver/driver-full-prototype.css');
    expect(css).toContain('.driver-prototype-port');
    expect(css).not.toContain('.admin-top-shell');
  });
});
