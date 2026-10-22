import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(
  path.join(process.cwd(), 'app/super-admin/operations/control-centre/page.module.css'),
  'utf8',
);

describe('Super Admin Control Centre responsive interaction contract', () => {
  it('keeps interactive controls at or above 44px', () => {
    expect(css).toContain('.button,');
    expect(css).toContain('min-height: 44px;');
    expect(css).toContain('.filters select, .filters input { min-height: 44px;');
    expect(css).toContain('.footerLinks a { min-height: 44px;');
  });

  it('uses a clear keyboard focus ring on interactive controls', () => {
    expect(css).toContain('.secondaryButton:focus-visible');
    expect(css).toContain('outline: 3px solid rgba(29, 87, 216, 0.32)');
  });

  it('collapses operational grids to one column on phone widths', () => {
    expect(css).toContain('@media (max-width: 620px)');
    expect(css).toContain('.jobGrid, .driverGrid, .fleetGrid');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(css).toContain('overflow-x: visible;');
  });
});
