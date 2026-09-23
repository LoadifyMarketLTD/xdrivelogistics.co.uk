import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Driver prototype migration contract', () => {
  const layout = read('app/driver/layout.tsx');
  const css = read('app/driver/driver-prototype-parity.css');

  it('loads the prototype parity layer after the existing Driver convergence styles', () => {
    const close = layout.indexOf("driver-dashboard-cx-close.css");
    const parity = layout.indexOf("driver-prototype-parity.css");
    expect(close).toBeGreaterThan(-1);
    expect(parity).toBeGreaterThan(close);
  });

  it('covers every real Driver prototype surface except Fleet', () => {
    for (const token of [
      'driver-reference-dashboard',
      'driver-reference-availability',
      'driver-returns-exchange',
      'driver-load-row__top',
      'driver-quotes-board',
      'driver-diary-route',
      'driver-finance-board',
      'xdrive-post-load-form',
      'driver-account-workspace',
      'workspace-board-layout',
    ]) expect(css).toContain(token);
  });

  it('does not touch the navbar or Fleet in the prototype parity layer', () => {
    expect(css).not.toContain('driver-top-nav');
    expect(css).not.toContain('driver-top-shell__header');
    expect(css).not.toMatch(/\\.(?:driver-)?fleet/i);
  });

  it('keeps prototype data out of the live Driver workspace', () => {
    for (const fake of ['North West Freight Ltd', 'Rapid Logistics UK Ltd', 'Nolawi Express Logistics', 'Save local prototype']) {
      expect(css).not.toContain(fake);
      expect(layout).not.toContain(fake);
    }
    expect(layout).not.toContain('suite.js');
  });

  it('keeps real data/authoritative flows on the live pages', () => {
    const dashboard = read('app/driver/page.tsx');
    const loads = read('app/driver/loads/page.tsx');
    const quotes = read('app/driver/quotes/page.tsx');
    const diary = read('app/driver/history/page.tsx');
    const returns = read('app/driver/returns/page.tsx');
    const availability = read('app/driver/availability/page.tsx');
    const finance = read('app/driver/finance/page.tsx');

    expect(dashboard).toContain("supabase.rpc('driver_update_job_status_atomic'");
    expect(loads).toContain('/api/driver/marketplace/loads');
    expect(quotes).toContain(".from('job_bids')");
    expect(diary).toContain(".from('jobs')");
    expect(returns).toContain("/api/driver/return-journeys");
    expect(availability).toContain(".from('drivers')");
    expect(finance).toContain("/api/driver/finance/invoices");
  });

  it('matches the approved prototype density at desktop scale', () => {
    expect(css).toContain('--driver-prototype-rail: 245px;');
    expect(css).toContain('min-height: 42px !important;');
    expect(css).toContain('min-height: 36px !important;');
    expect(css).toContain('min-height: 38px !important;');
    expect(css).toContain('min-height: 82px !important;');
    expect(css).toContain('font-size: 13.5px !important;');
  });
});