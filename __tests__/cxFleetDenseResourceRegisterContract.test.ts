import fs from 'node:fs';
import path from 'node:path';

const fleet = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/FleetControlDashboardHome.tsx'), 'utf8');

describe('CX-density My Fleet resource register', () => {
  it('keeps the compact operational signal strip and collapses the dashboard into a resource register', () => {
    expect(fleet).toContain('<OperationalSignalStrip');
    expect(fleet).toContain('Fleet resource register');
    expect(fleet).toContain('Current location / tracked');
    expect(fleet).toContain('Future position');
    expect(fleet).toContain('Return journey');
    expect(fleet).toContain('Advertise');
    expect(fleet).not.toContain('<OperationalWorkspaceGrid');
    expect(fleet).not.toContain('<OperationalAttentionRail');
  });

  it('reuses real operations intelligence instead of prototype data', () => {
    expect(fleet).toContain('useOperationsIntelligence(data.companyId)');
    expect(fleet).toContain('intelligence.futureByDriver');
    expect(fleet).toContain('intelligence.journeyByDriver');
    expect(fleet).toContain('intelligence.advertisingByVehicle');
    expect(fleet).not.toContain('Mercedes Sprinter');
    expect(fleet).not.toContain('BD57 XDL');
  });

  it('retains canonical fleet routes and server-side eligibility truth', () => {
    for (const route of ['/admin/fleet/assignments','/admin/fleet/drivers','/admin/fleet/vehicles','/admin/fleet/positions','/admin/fleet/returns','/admin/fleet/compliance']) expect(fleet).toContain(route);
    expect(fleet).toContain('Canonical eligibility is enforced server-side.');
  });
});
