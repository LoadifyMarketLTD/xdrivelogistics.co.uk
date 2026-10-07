import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Driver Loads / Quotes runtime visibility regressions', () => {
  const loads = read('app/driver/loads/page.tsx');
  const quotes = read('app/driver/quotes/page.tsx');
  const css = read('app/driver/driver-full-prototype.css');

  it('places load notes, requirements and quote editor on distinct expanded rows', () => {
    expect(loads).toContain('load-extra-note load-extra-requirements');
    expect(css).toContain('.load-extra-note:not(.load-extra-requirements)');
    expect(css).toContain('grid-row:2!important');
    expect(css).toContain('.load-extra-requirements');
    expect(css).toContain('grid-row:3!important');
    expect(css).toContain('.driver-inline-quote');
    expect(css).toContain('grid-row:4!important');
  });

  it('adds the parent open state required by Quotes CSS when a quote is expanded', () => {
    expect(quotes).toContain("quote-sheet${expanded ? ' open' : ''}");
    expect(css).toContain('.driver-quotes-prototype .quote-sheet.open .quote-entry-extra');
    expect(css).toContain('display:grid!important');
  });

  it('allows a withdrawn quote to become actionable again', () => {
    expect(loads).toContain("load.myBid.status !== 'withdrawn'");
  });
});
