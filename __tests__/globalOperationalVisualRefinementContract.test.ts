import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.join(process.cwd(), 'app/components/workspace/workspace-readable-typography.css'),
  'utf8',
);

describe('global operational visual refinement contract', () => {
  it('keeps the approved readable type hierarchy', () => {
    expect(css).toContain('--ws-filter-rail-w: 196px;');
    expect(css).toContain('--ws-control-h: 32px;');
    expect(css).toContain('--ws-panel-head-h: 40px;');
    expect(css).toContain('.xdrive-page-header__title');
    expect(css).toContain('font-size: 20px !important;');
    expect(css).toContain('font-size: 16px !important;');
    expect(css).toContain('font-size: 14px !important;');
  });

  it('keeps the top navbar as the only 13px operational exception', () => {
    expect(css).toContain('.top-workspace-nav__item');
    expect(css).toContain('font-size: 13px !important;');
  });

  it('widens search rails and normalises panel/table geometry', () => {
    expect(css).toContain('grid-template-columns: 196px minmax(0, 1fr) !important;');
    expect(css).toContain('width: 196px !important;');
    expect(css).toContain('min-height: 40px !important;');
    expect(css).toContain('height: 42px !important;');
    expect(css).toContain('min-height: 46px !important;');
  });

  it('makes Live Availability and Nearby maps dominant workspace objects', () => {
    expect(css).toContain('.driver-live-availability-canonical');
    expect(css).toContain('.driver-live-availability-prototype');
    expect(css).toContain('min-height: 430px !important;');
    expect(css).toContain('height: clamp(430px, 48vh, 560px) !important;');
  });

  it('collapses the filter rail before it becomes cramped', () => {
    expect(css).toContain('@media (max-width: 1180px)');
    expect(css).toContain('grid-template-columns: 1fr !important;');
  });
});
