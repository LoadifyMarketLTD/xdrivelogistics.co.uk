import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/loads/page.tsx', 'utf8');
const css = readFileSync('app/driver/driver-full-prototype.css', 'utf8');

describe('Driver Loads stable result controls', () => {
  it('keeps the refresh control visually static during background refresh', () => {
    expect(page).toContain('className="btn load-refresh-stable"');
    expect(page).toContain('>Refresh</button>');
    expect(page).not.toContain("refreshing ? 'Refreshing…' : 'Refresh'");
  });

  it('uses fixed geometry classes for controls that change text or values', () => {
    for (const cls of ['load-sort-control','load-expand-control','load-page-size-control','load-range-count','load-prev-stable','load-page-count','load-next-stable','load-refresh-stable']) {
      expect(page).toContain(cls);
    }
    expect(css).toContain('freeze result-control geometry');
    expect(css).toContain('grid-template-columns:116px 154px 118px 54px 66px 68px 48px 58px!important');
  });
});