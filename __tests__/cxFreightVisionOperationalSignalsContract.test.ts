import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/admin/freight-vision/page.tsx'), 'utf8');

describe('CX-close Freight Vision operational signals', () => {
  it('uses Freight Vision specific operational states rather than a generic KPI wall', () => {
    expect(source).toContain('OperationalSignalStrip');
    expect(source).not.toContain('KpiGrid');
    expect(source).not.toContain('KpiCard');
    for (const label of ['Active jobs', 'On time', 'Behind ETA', 'Late', 'Not tracking', 'Not started']) {
      expect(source).toContain(`label: '${label}'`);
    }
  });

  it('makes each state signal actionable as a tracking filter', () => {
    expect(source).toContain("onClick: () => setStateFilter('all')");
    expect(source).toContain("onClick: () => setStateFilter('on_time')");
    expect(source).toContain("onClick: () => setStateFilter('behind_eta')");
    expect(source).toContain("onClick: () => setStateFilter('late')");
    expect(source).toContain("onClick: () => setStateFilter('not_tracking')");
    expect(source).toContain("onClick: () => setStateFilter('not_started')");
  });

  it('preserves map, exception register and job inspection', () => {
    expect(source).toContain('FleetPositionMap');
    expect(source).toContain('Exception register');
    expect(source).toContain('Operational timeline');
    expect(source).toContain('Open full job');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(source).not.toContain('/super-admin');
  });
});
