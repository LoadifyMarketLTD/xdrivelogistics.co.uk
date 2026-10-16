import fs from 'node:fs';
import path from 'node:path';

const fleet = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/FleetControlDashboardHome.tsx'), 'utf8');

describe('CX-density My Fleet resource register', () => {
  it('keeps the measured Courier Exchange live dashboard structure while retaining the dense fleet resource register', () => {
    expect(fleet).toContain('title="Reports & Statistics"');
    expect(fleet).toContain('title="Activity at a glance"');
    expect(fleet).toContain('<OperationalSignalStrip');
    expect(fleet).toContain('Fleet resource register');
    expect(fleet).toContain('Current location / tracked');
    expect(fleet).toContain('Future position');
    expect(fleet).toContain('Return journey');
    expect(fleet).toContain('Advertise');
    expect(fleet).not.toContain('<OperationalWorkspaceGrid');
    expect(fleet).not.toContain('<OperationalAttentionRail');
    expect(fleet).not.toContain('<DashboardHomeHeader');
  });

  it('reuses real operations intelligence instead of prototype data', () => {
    expect(fleet).toContain('useOperationsIntelligence(data.companyId)');
    expect(fleet).toContain('intelligence.futureByDriver');
    expect(fleet).toContain('intelligence.journeyByDriver');
    expect(fleet).toContain('intelligence.advertisingByVehicle');
    expect(fleet).not.toContain('Mercedes Sprinter');
    expect(fleet).not.toContain('BD57 XDL');
  });

  it('uses responsive shared filter geometry for the Fleet resource register and Future Position editor', () => {
    const resourceRoute = fs.readFileSync(path.join(process.cwd(), 'app/admin/fleet/resources/page.tsx'), 'utf8');
    const baseline = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/workspace-measured-cx-baseline.css'), 'utf8');
    expect(resourceRoute).toContain('className="workspace-filter-fields"');
    expect(resourceRoute).toContain('className="workspace-filter-fields workspace-filter-fields--even"');
    expect(resourceRoute).not.toContain("gridTemplateColumns: 'minmax(220px,2fr)");
    expect(baseline).toContain('.workspace-filter-fields--even > :first-child');
    expect(baseline).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
  });

  it('retains canonical fleet routes and server-side eligibility truth', () => {
    for (const route of ['/admin/fleet/assignments','/admin/fleet/drivers','/admin/fleet/vehicles','/admin/fleet/positions','/admin/fleet/returns','/admin/fleet/compliance']) expect(fleet).toContain(route);
    expect(fleet).toContain("router.push('/admin/fleet/assignments')");
  });
});
