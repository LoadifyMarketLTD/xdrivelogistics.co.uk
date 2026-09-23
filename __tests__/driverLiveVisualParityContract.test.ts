import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('live Driver approved prototype parity contract', () => {
  it('keeps the full prototype information architecture visible', () => {
    const shell = read('app/driver/_components/DriverTopWorkspaceShell.tsx');
    for (const label of ['Dashboard','Directory','Live Availability','My Fleet','Return Journeys','Loads','Quotes','Diary','Freight Vision','Finance','Drivers & Vehicles']) {
      expect(shell).toContain(`label: '${label}'`);
    }
    expect(shell).not.toContain('global-rail');
    expect(shell).toContain('topbar');
    expect(shell).toContain('main-nav');
    expect(shell).toContain('driver-settings-menu');
  });

  it('loads the literal full prototype CSS in the Driver layout', () => {
    const layout = read('app/driver/layout.tsx');
    const full = layout.indexOf("driver-full-prototype.css");
    expect(full).toBeGreaterThan(-1);
    expect(layout).toContain("driver-dashboard-prototype-exact.css");
  });
  it('keeps the dashboard as a compact operational register, not a SaaS card wall', () => {
    const page = read('app/driver/page.tsx');
    for (const marker of ['driver-dashboard-statusbar','driver-dashboard-register','driver-dashboard-tabs','driver-dashboard-readiness']) {
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

  it('keeps Company workspace files out of the Driver prototype port', () => {
    const css = read('app/driver/driver-full-prototype.css');
    expect(css).toContain('.driver-prototype-port');
    expect(css).not.toContain('.admin-top-shell');
  });
});
