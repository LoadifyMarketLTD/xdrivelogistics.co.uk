import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/loads/page.tsx', 'utf8');
const api = readFileSync('app/api/driver/marketplace/loads/route.ts', 'utf8');
const css = readFileSync('app/driver/driver-full-prototype.css', 'utf8');

describe('Driver Loads CX compact parity', () => {
  it('keeps quick facts inside the expandable region, not permanently below the card header', () => {
    const expandable = page.indexOf("className={'load-extra cx-load-extra '");
    const facts = page.indexOf('className="load-facts-row"');
    expect(expandable).toBeGreaterThan(-1);
    expect(facts).toBeGreaterThan(expandable);
  });

  it('uses the same three-column geometry for primary and expanded facts', () => {
    expect(css).toContain('grid-template-columns:minmax(0,1.12fr) minmax(0,1fr) minmax(300px,.98fr)!important');
    expect(page).toContain('className="load-facts-col"');
  });

  it('shows city plus public outcode without exposing full postcode', () => {
    expect(api).toContain('publicTownArea(job.pickup_city, job.pickup_location, job.pickup_postcode');
    expect(api).toContain('publicTownArea(job.delivery_city, job.delivery_location, job.delivery_postcode');
    expect(api).toContain('const explicitCity = marketplaceText(cityValue)?.trim()');
    expect(api).toContain('const outcode = publicOutcode(postcodeValue)');
    expect(api).toContain('pickup_postcode_full: null');
    expect(api).toContain('delivery_postcode_full: null');
  });

  it('uses one compact footer strip', () => {
    expect(page).toContain('className="load-footer-spacer"');
    expect(page).toContain('className="load-footer-identity"');
    expect(page).not.toContain('className="load-card-footer-main"');
  });
});