import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Super Admin unified premium visual system', () => {
  it('loads the final premium stylesheet after all prior preview layers', () => {
    const layout = read('app/super-admin/layout.tsx');
    const convergence = layout.indexOf("import './super-admin-visual-convergence.css';");
    const finalLayer = layout.indexOf("import './super-admin-premium-final.css';");

    expect(convergence).toBeGreaterThan(-1);
    expect(finalLayer).toBeGreaterThan(convergence);
  });

  it('uses the same structural primitives on the Super Admin home', () => {
    const home = read('app/super-admin/page.tsx');

    expect(home).toContain('className="sa-page sa-home-page"');
    expect(home).toContain('className="sa-page-header"');
    expect(home).toContain('className="sa-metric-card"');
    expect(home).toContain('className="sa-directory-grid"');
    expect(home).toContain('className="sa-panel sa-attention-panel"');
  });

  it('uses the same structural primitives in Action Centre', () => {
    const actionCentre = read('app/super-admin/action-centre/page.tsx');

    expect(actionCentre).toContain('className="sa-page sa-action-centre-premium"');
    expect(actionCentre).toContain('className="sa-page-header"');
    expect(actionCentre).toContain('className="sa-metric-card"');
    expect(actionCentre).toContain('className="sa-filter-bar"');
    expect(actionCentre).toContain('className="sa-panel"');
  });

  it('renders premium line iconography in shared live-table pages instead of legacy emoji icons', () => {
    const liveTable = read('app/super-admin/_components/SuperAdminLiveTablePage.tsx');

    expect(liveTable).toContain("from 'lucide-react'");
    expect(liveTable).toContain('resolvePageIcon(sectionLabel, title)');
    expect(liveTable).toContain('<PageIcon size={18} strokeWidth={1.8} />');
    expect(liveTable).not.toContain('className="sa-page-icon">{icon}');
  });

  it('normalises home, list, inspector, table and pager surfaces in the final stylesheet', () => {
    const styles = read('app/super-admin/super-admin-premium-final.css');

    expect(styles).toContain('.super-admin-visual-root .sa-page-icon');
    expect(styles).toContain('.super-admin-visual-root .sa-inspector details');
    expect(styles).toContain('.super-admin-visual-root .sa-data-table');
    expect(styles).toContain('.super-admin-visual-root .sa-pager');
    expect(styles).toContain('.super-admin-visual-root .sa-directory-icon');
  });
});
