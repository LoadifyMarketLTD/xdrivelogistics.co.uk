import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/history/page.tsx', 'utf8');
const css = readFileSync('app/driver/history/diary-exchange.css', 'utf8');

describe('Owner Driver Diary single-row control bar', () => {
  it('wraps Diary tabs, count and paging controls into one physical toolbar', () => {
    expect(page).toContain('className="diary-toolbar-single"');
    expect(css).toContain('PR675 Diary: single-row control bar aligned with Loads');
    expect(css).toContain('flex-wrap:nowrap!important');
    expect(css).toContain('display:contents!important');
  });

  it('retains all Diary status tabs and controls', () => {
    for (const label of ['Collapse all', 'Expand all', 'Per page:']) expect(page).toContain(label);
    expect(page).toContain('aria-label="Diary states"');
  });

  it('keeps the toolbar compact like Loads', () => {
    expect(css).toContain('height:36px!important');
    expect(css).toContain('min-height:35px!important');
    expect(css).toContain('font-size:9.7px!important');
  });
});