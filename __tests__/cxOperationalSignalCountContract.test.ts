import fs from 'node:fs';
import path from 'node:path';

const component = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationalConvergence.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationalConvergence.module.css'), 'utf8');

describe('role-driven operational signal counts', () => {
  it('derives desktop signal columns from the actual role/dashboard items', () => {
    expect(component).toContain('Math.min(items.length, 10)');
    expect(component).toContain("'--signal-columns': desktopColumns");
    expect(component).toContain('data-signal-count={items.length}');
  });

  it('does not impose a universal six-column desktop grid', () => {
    expect(css).toContain('repeat(var(--signal-columns, 6), minmax(0, 1fr))');
    expect(css).not.toContain('grid-template-columns: repeat(6, minmax(0, 1fr))');
  });

  it('keeps responsive density independent of the desktop role signal count', () => {
    expect(css).toContain('@media (max-width: 1279px)');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(component).not.toContain('/super-admin');
    expect(css).not.toContain('/super-admin');
  });
});
