import fs from 'node:fs';
import path from 'node:path';

describe('Carrier settings and navbar consolidation contract', () => {
  const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
  const shellCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/top-workspace-shell.css'), 'utf8');
  const settingsCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/role-settings-workspace.css'), 'utf8');

  it('keeps settings-owned administration routes out of the Carrier More menu', () => {
    for (const href of [
      '/admin/documents',
      '/admin/event-log',
      '/admin/team',
      '/admin/fleet/managers',
      '/admin/dispatchers',
      '/admin/settings/billing',
      '/admin/drivers',
      '/admin/vehicles',
      '/admin/fleet/positions',
    ]) {
      expect(shell).toContain(href);
    }
    expect(shell).toContain('settingsOwnedHrefs');
    expect(shell).toContain('!settingsOwnedHrefs.has(href)');
  });

  it('uses a burger trigger for the Carrier utility menu', () => {
    expect(shell).toContain("group.id === 'carrier-more'");
    expect(shell).toContain('<Menu aria-hidden="true" size={18}');
    expect(shell).toContain('<span className="sr-only">{group.label}</span>');
  });

  it('renders the active Carrier page title and description on the navbar row', () => {
    expect(shell).toContain('CARRIER_PAGE_CONTEXTS');
    expect(shell).toContain("title: 'Diary'");
    expect(shell).toContain('Post-award bookings, allocation, evidence and authorised job records in one operating register.');
    expect(shell).toContain('top-workspace-nav__context');
    expect(shellCss).toContain('.top-workspace-nav__context');
    expect(shellCss).toContain('.xdrive-page-header__copy');
  });

  it('keeps Settings compact rather than leaving oversized gaps', () => {
    expect(settingsCss).toContain('grid-template-columns: 150px minmax(0, 1fr)');
    expect(settingsCss).toContain('min-height: 28px');
    expect(settingsCss).toContain('min-height: 34px');
  });
});
