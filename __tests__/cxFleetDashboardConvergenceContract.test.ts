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

  it('places the execution queue and resource table in the main operational canvas with attention beside them', () => {
    expect(source).toContain('<OperationalWorkspaceGrid');
    expect(source).toContain('Won / Received → Allocation → Execution');
    expect(source).toContain('Fleet resource status');
    expect(source).toContain('<OperationalAttentionRail');

    expect(source.indexOf('Won / Received → Allocation → Execution')).toBeLessThan(source.indexOf('Fleet resource status'));
    expect(source.indexOf('<OperationalSignalStrip')).toBeLessThan(source.indexOf('<OperationalWorkspaceGrid'));
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
