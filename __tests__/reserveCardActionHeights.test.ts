import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('driver-pwa-reserve/src/DriverReadability.css', 'utf8');
const html = readFileSync('public/driver/reserve-pwa/index.html', 'utf8');
const bundle = readFileSync('public/driver/reserve-pwa/assets/index-B-EYN8jE.css', 'utf8');
const cards = readFileSync('driver-pwa-reserve/src/ReserveApp.tsx', 'utf8');

describe('Driver PWA card action dimensions', () => {
  it('enforces one fixed height for two-column action buttons and invoice', () => {
    const block = source.slice(source.indexOf('/* One consistent action height'));
    expect(block).toContain('.rv-job .rv-actions > button');
    expect(block).toContain('.rv-job .rv-booking-actions > button.rv-wide');
    expect(block).toContain('height:50px!important');
    expect(block).toContain('min-height:50px!important');
    expect(block).toContain('max-height:50px!important');
    expect(block).toContain('align-items:center');
  });
  it('actually publishes the CSS containing card height rules', () => {
    expect(html).toContain('index-B-EYN8jE.css');
    expect(bundle).toContain('height:50px!important');
  });
  it('preserves actual booking and invoice handlers', () => {
    expect(cards).toContain("onClick={()=>open(j,'details')}");
    expect(cards).toContain("onClick={()=>open(j,invoiceAction(j).target)}");
    expect(cards).toContain('View POD & Status');
  });
});
