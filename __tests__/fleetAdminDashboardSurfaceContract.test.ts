import fs from 'node:fs';
import path from 'node:path';

describe('Fleet admin dashboard surface contract', () => {
  const adminHome = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/AdminRoleDashboardHome.tsx'),
    'utf8',
  );
  const fleetRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/fleet/page.tsx'),
    'utf8',
  );

  it('uses the canonical carrier/company Dashboard for fleet-manager /admin', () => {
    expect(adminHome).toContain("case 'fleet':");
    expect(adminHome).toContain('return <CarrierOperationsDashboardHome />;');
  });

  it('keeps fleet-specific control in My Fleet instead of duplicating it on /admin', () => {
    expect(fleetRoute).toContain('FleetControlDashboardHome');
    expect(fleetRoute).toContain('<FleetControlDashboardHome />');
  });
});
