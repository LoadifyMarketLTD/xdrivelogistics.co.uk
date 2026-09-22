import fs from 'node:fs';
import path from 'node:path';

describe('Fleet CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/FleetControlDashboardHome.tsx'),
    'utf8',
  );

  it('uses compact signals instead of the six-card KPI wall', () => {
    expect(source).toContain('<OperationalSignalStrip');
    expect(source).not.toContain('<ExchangeKpiStrip>');
    expect(source).not.toContain('<KpiCard');
    expect(source).toContain("label: 'Unallocated'");
    expect(source).toContain("label: 'Tracking Alerts'");
    expect(source).toContain("label: 'Compliance Alerts'");
  });

  it('uses a dense Fleet resource register and keeps attention below rather than reserving a permanent side rail', () => {
    expect(source).toContain('Fleet resource register');
    expect(source).toContain('Current location / tracked');
    expect(source).toContain('Future position');
    expect(source).toContain('Return journey');
    expect(source).toContain('Advertise');
    expect(source).toContain('Fleet attention');
    expect(source).not.toContain('<OperationalWorkspaceGrid');
    expect(source).not.toContain('<OperationalAttentionRail');

    expect(source.indexOf('<OperationalSignalStrip')).toBeLessThan(source.indexOf('Fleet resource register'));
    expect(source.indexOf('Fleet resource register')).toBeLessThan(source.indexOf('Fleet attention'));
  });

  it('keeps unavailable tracking and compliance signals truthful', () => {
    expect(source).toContain("value: trackingDataUnavailable ? '—' : trackingAttentionCount");
    expect(source).toContain("value: complianceDataUnavailable ? '—' : complianceAttentionCount");
    expect(source).not.toContain('Vehicles unavailable');
  });

  it('preserves existing operational routes and server-side eligibility language', () => {
    for (const route of [
      '/admin/fleet/assignments',
      '/admin/fleet/drivers',
      '/admin/fleet/vehicles',
      '/admin/fleet/positions',
      '/admin/fleet/compliance',
    ]) {
      expect(source).toContain(route);
    }
    expect(source).toContain('Canonical eligibility is enforced server-side.');
  });
});
