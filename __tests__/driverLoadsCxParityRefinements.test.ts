import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('app/driver/loads/page.tsx', 'utf8');

describe('Driver Loads CX parity refinements', () => {
  it('shows quote-safe pickup/delivery schedules including ASAP and explicit time slots', () => {
    expect(source).toContain('fmtSchedule(load.pickup_datetime, load.pickup_time_slot)');
    expect(source).toContain('fmtSchedule(load.delivery_datetime, load.delivery_time_slot)');
    expect(source).toContain("normalized.toUpperCase() === 'ASAP'");
  });

  it('adds body-type filtering without inventing a new backend field', () => {
    expect(source).toContain("type BodyTypeFilter =");
    expect(source).toContain('bodyTypeFor(load)');
    expect(source).toContain('Any body type');
    expect(source).toContain('Curtainside');
    expect(source).toContain('Flatbed');
  });

  it('uses controlled freight taxonomy and clear controls', () => {
    expect(source).toContain('Any freight type');
    expect(source).toContain('ADR / Dangerous Goods');
    expect(source).toContain('aria-label="Clear origin"');
    expect(source).toContain('aria-label="Clear destination"');
    expect(source).toContain('aria-label="Clear member"');
  });

  it('surfaces posted timezone, vehicle glyph and payment terms', () => {
    expect(source).toContain("timeZone: 'Europe/London'");
    expect(source).toContain('<VehicleGlyph />');
    expect(source).toContain('<b>Payment Terms</b>');
  });

  it('keeps the footer identity compact and scanable', () => {
    expect(source).toContain('className="load-footer-identity"');
    expect(source).toContain("{load.member.memberId ?? 'Member ID unavailable'}");
  });
});
