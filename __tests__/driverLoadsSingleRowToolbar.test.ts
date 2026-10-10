import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/loads/page.tsx', 'utf8');
const css = readFileSync('app/driver/driver-full-prototype.css', 'utf8');

describe('Driver Loads approved single-row toolbar', () => {
  it('wraps both legacy toolbar groups into one physical row', () => {
    expect(page).toContain('className="load-toolbar-single"');
    expect(css).toContain('PR675 Loads: approved single-row toolbar');
    expect(css).toContain('flex-wrap:nowrap!important');
    expect(css).toContain('display:contents!important');
  });

  it('keeps every approved control in the same toolbar', () => {
    for (const label of ['All Live','On Demand','Regular Load','Daily Hire','Posted within','List View','Map View','Sort','Expand all visible loads','Items per Page','Previous','Next','Refresh']) {
      expect(page).toContain(label);
    }
  });

  it('keeps the row compact and stable', () => {
    expect(css).toContain('height:36px!important');
    expect(css).toContain('load-refresh-stable');
    expect(css).toContain('load-expand-control');
    expect(css).toContain('load-page-size-control');
  });
});