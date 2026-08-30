import fs from 'node:fs';
import path from 'node:path';

describe('Dispatcher CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/DispatcherControlDashboardHome.tsx'),
    'utf8',
  );

  it('replaces the KPI wall with compact operational signals', () => {
    expect(source).toContain('<OperationalSignalStrip');
    expect(source).not.toContain('<KpiGrid>');
    expect(source).not.toContain('<KpiCard');
    for (const label of ['Unallocated', 'Due next 2h', 'Active', 'Exceptions', 'Available Drivers', 'Stale GPS']) {
      expect(source).toContain(`label: '${label}'`);
    }
  });

  it('keeps dispatch priorities in the main canvas and live exceptions beside them', () => {
    expect(source).toContain('<OperationalWorkspaceGrid');
    expect(source).toContain('Dispatch priority queue');
    expect(source).toContain('<OperationalAttentionRail');
    expect(source).toContain('Live exceptions');
    expect(source.indexOf('Dispatch priority queue')).toBeLessThan(source.indexOf('Resource availability'));
  });

  it('preserves dispatcher-only operational boundaries and verified routes', () => {
    expect(source).toContain('Marketplace pricing and finance are intentionally outside this workspace.');
    expect(source).not.toContain('/admin/finance');
    expect(source).not.toContain('/admin/marketplace');
    for (const route of ['/admin/fleet/assignments', '/admin/fleet/positions', '/admin/diary', '/admin/incidents']) {
      expect(source).toContain(route);
    }
  });

  it('does not fabricate stale GPS counts when tracking data is unavailable', () => {
    expect(source).toContain("value: trackingUnavailable ? '—' : stalePositions.length");
  });
});
