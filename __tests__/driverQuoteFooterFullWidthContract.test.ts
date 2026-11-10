import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Owner Driver Quotes booking offer action layout', () => {
  const card = readFileSync('app/components/workspace/Master3150Card.tsx', 'utf8');
  const css = readFileSync('app/components/workspace/master3150-record-card.css', 'utf8');
  const page = readFileSync('app/driver/quotes/page.tsx', 'utf8');
  it('places quote actions outside the narrow posting-company column', () => {
    expect(card).toContain("mode !== 'quote' && <div");
    expect(card).toContain("mode === 'quote' && <div");
    expect(card).toContain('master3150-record__full-footer');
    expect(css).toContain('grid-column:1 / -1');
  });
  it('preserves booking offer navigation and allows long controls to wrap', () => {
    expect(page).toContain('Review Booking Offer');
    expect(page).toContain("router.push('/driver/won-work')");
    expect(css).toContain('min-width:160px !important');
    expect(css).toContain('overflow-wrap:anywhere');
  });
});
