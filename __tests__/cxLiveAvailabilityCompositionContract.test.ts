import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/admin/live-availability/page.tsx'), 'utf8');

describe('CX-close Live Availability composition', () => {
  it('uses role-specific compact operational signals instead of the old KPI wall', () => {
    expect(source).toContain('OperationalSignalStrip');
    expect(source).not.toContain('KpiGrid');
    expect(source).not.toContain('<KpiCard');
  });

  it('keeps Live Fleet, Future and Nearby Exchange as primary page tabs', () => {
    expect(source).toContain('Live Fleet');
    expect(source).toContain('Future');
    expect(source).toContain('Nearby Exchange');
    const tabs = source.indexOf('aria-label="Availability views"');
    const signals = source.indexOf('<OperationalSignalStrip');
    expect(tabs).toBeGreaterThan(0);
    expect(signals).toBeGreaterThan(tabs);
  });

  it('keeps meaningful Fleet signals without imposing a global dashboard count', () => {
    expect(source).toContain("label: 'Available'");
    expect(source).toContain("label: 'Busy'");
    expect(source).toContain("label: 'Fresh locations'");
    expect(source).toContain("label: 'Stale / missing'");
    expect(source).toContain("label: 'Future positions'");
    expect(source).toContain("label: 'Availability conflicts'");
  });

  it('uses the measured control geometry', () => {
    expect(source).toContain('minHeight: 32');
    expect(source).toContain('borderRadius: 4');
    expect(source).toContain('minHeight: 28');
  });

  it('preserves privacy-scoped Nearby Exchange behaviour', () => {
    expect(source).toContain('/api/availability/nearby');
    expect(source).toContain("position.scope === 'exchange'");
    expect(source).toContain('driver identity is not disclosed');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(source).not.toContain('/super-admin');
  });
});
