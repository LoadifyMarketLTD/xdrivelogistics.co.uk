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
    const css = fs.readFileSync(path.join(process.cwd(), 'app/admin/live-availability/LiveAvailability.module.css'), 'utf8');
    const splitCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CarrierMapRegisterSplit.module.css'), 'utf8');
    expect(css).toContain('min-height: 32px');
    expect(css).toContain('border-radius: 4px');
    expect(splitCss).toContain('min-height: 28px');
    expect(source).toContain('CarrierMapRegisterSplit');
    expect(source).toContain('height={280}');
  });

  it('supports CX-style saved availability defaults without inventing server preferences', () => {
    expect(source).toContain('LIVE_AVAILABILITY_DEFAULTS_KEY');
    expect(source).toContain('window.localStorage.setItem');
    expect(source).toContain('Save Default');
    expect(source).toContain('Load Default');
    expect(source).toContain('Clear');
  });

  it('preserves privacy-scoped Nearby Exchange behaviour', () => {
    expect(source).toContain('/api/availability/nearby');
    expect(source).toContain("position.scope === 'exchange'");
    expect(source).toContain('driver identity is not disclosed');
  });

  it('adds CX-style contextual actions without exposing driver identity', () => {
    expect(source).toContain('/admin/messages?companyId=');
    expect(source).toContain('/admin/post-load?directCarrier=');
    expect(source).toContain('Message');
    expect(source).toContain('Book Direct');
    expect(source).not.toContain('position.driver_id');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(source).not.toContain('/super-admin');
  });
});
