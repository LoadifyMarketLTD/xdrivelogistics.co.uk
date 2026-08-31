import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Super Admin #431 visual convergence', () => {
  it('loads the convergence layer after the preview styles', () => {
    const layout = read('app/super-admin/layout.tsx');
    expect(layout.indexOf("./super-admin-visual-preview.css")).toBeGreaterThan(-1);
    expect(layout.indexOf("./super-admin-visual-convergence.css")).toBeGreaterThan(layout.indexOf("./super-admin-visual-preview.css"));
  });

  it('gives live table pages a canonical toolbar slot below the page header', () => {
    const source = read('app/super-admin/_components/SuperAdminLiveTablePage.tsx');
    const headerEnd = source.indexOf('</header>');
    const toolbar = source.indexOf('{toolbar}', headerEnd);
    const errorState = source.indexOf('{error &&', headerEnd);
    expect(headerEnd).toBeGreaterThan(-1);
    expect(toolbar).toBeGreaterThan(headerEnd);
    expect(errorState).toBeGreaterThan(toolbar);
  });

  it('renders Notification filters through the shared page toolbar rather than above the page', () => {
    const source = read('app/super-admin/notifications/page.tsx');
    expect(source).toContain('className="sa-filter-bar"');
    expect(source).toContain('toolbar={toolbar}');
    expect(source).not.toContain("borderRadius: '4px'");
  });

  it('renders Action Centre with the same page, metric, filter and panel primitives', () => {
    const source = read('app/super-admin/action-centre/page.tsx');
    expect(source).toContain('className="sa-page"');
    expect(source).toContain('className="sa-page-header"');
    expect(source).toContain('className="sa-metric-grid"');
    expect(source).toContain('className="sa-filter-bar"');
    expect(source).toContain('className="sa-panel"');
  });

  it('removes the separate decorative inspector hero design', () => {
    const source = read('app/super-admin/super-admin-visual-convergence.css');
    expect(source).toContain('.super-admin-visual-root .sa-inspector-hero');
    expect(source).toContain('background: transparent');
    expect(source).toContain('box-shadow: none');
    expect(source).toContain('.super-admin-visual-root .sa-inspector-hero::after { display: none; }');
  });
});
