import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Driver Loads / Quotes runtime visibility regressions', () => {
  const loads = read('app/driver/loads/page.tsx');
  const quotes = read('app/driver/quotes/page.tsx');
  const css = read('app/driver/driver-full-prototype.css');
  const loadsConvergence = read('app/driver/driver-cx-loads-convergence.css');
  const jobs = read('app/driver/jobs/page.tsx');

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

  it('scopes the marketplace quote modal so expanded My Jobs actions stay inline', () => {
    expect(loads).toContain('driver-inline-quote driver-inline-quote--marketplace');
    expect(loadsConvergence).toContain('body:has(.driver-inline-quote--marketplace)::before');
    expect(loadsConvergence).toContain('.driver-inline-quote--marketplace {');
    expect(loadsConvergence).not.toContain('body:has(.driver-inline-quote)::before');
    expect(css).toContain('.cx-load-card .driver-inline-quote--marketplace{');
    expect(css).toContain('.driver-loads-prototype .cx-load-card .driver-inline-quote--marketplace{');
    expect(css).not.toMatch(/\.cx-load-card \.driver-inline-quote\s*\{/);
    expect(jobs).toContain('driver-inline-quote driver-job-actions');
    expect(jobs).not.toContain('driver-inline-quote--marketplace');
  });
});
