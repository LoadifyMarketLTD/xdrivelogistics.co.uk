import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/loads/page.tsx', 'utf8');
const css = readFileSync('app/driver/driver-full-prototype.css', 'utf8');

describe('Driver Loads approved compact header mockup', () => {
  it('removes the redundant Search Loads Results heading', () => {
    expect(page).not.toContain('Search Loads Results');
  });

  it('uses Posted within + All in the first row', () => {
    expect(page).toContain('<span>Posted within</span>');
    expect(page).toContain('<option value="any">All</option>');
  });

  it('puts live result count directly beside List and Map view controls', () => {
    expect(page).toContain('className="load-result-left"');
    expect(page).toContain('className="load-result-count"');
    expect(page).toContain('className="load-view-switch"');
  });

  it('uses the approved compact two-row visual treatment', () => {
    expect(css).toContain('PR675 Loads: compact two-row result header matching approved mockup');
    expect(css).toContain('height:34px!important');
    expect(css).toContain('border-bottom:3px solid #0b6ff4!important');
  });
});