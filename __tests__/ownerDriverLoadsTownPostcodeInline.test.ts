import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('app/driver/driver-full-prototype.css', 'utf8');

describe('Loads town/postcode inline layout', () => {
  it('overrides inherited block spans inside route values', () => {
    expect(css).toContain('PR675 Loads: keep town and postcode inline');
    expect(css).toContain('.load-route-line>b .load-town');
    expect(css).toContain('display:inline!important');
    expect(css).toContain('white-space:nowrap!important');
  });
});