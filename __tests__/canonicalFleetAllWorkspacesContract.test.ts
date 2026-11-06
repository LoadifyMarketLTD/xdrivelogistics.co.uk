import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('3150 My Fleet is one visual component across authenticated roles', () => {
  const canonical = 'app/try-xdrive-demo/components/DemoFleetBoard.tsx';
  const shared = 'app/components/workspace/MemberFleetOverview.tsx';

  it('renders the approved demo 3150 board in every authenticated My Fleet overview', () => {
    const source = read(shared);
    expect(source).toContain("import DemoFleetBoard from '../../try-xdrive-demo/components/DemoFleetBoard'");
    expect(source).toContain("section === 'fleet'");
    expect(source).toContain('<DemoFleetBoard');
    expect(source).toContain('verifiedFleet=');
  });

  it('all four My Fleet role routes use the same secured overview', () => {
    for (const path of [
      'app/admin/fleet/page.tsx',
      'app/broker/fleet/page.tsx',
      'app/customer/fleet/page.tsx',
      'app/driver/fleet/page.tsx',
    ]) {
      expect(read(path), path).toContain('MemberFleetOverview');
      expect(read(path), path).toContain('section="fleet"');
    }
  });

  it('shows only verified company fleet records and never writes demonstration data to production', () => {
    const source = read(canonical);
    expect(source).toContain('verifiedFleet.vehicles.map');
    expect(source).toContain('verifiedFleet.drivers.map');
    expect(source).toContain('verifiedFleet?.documents');
    expect(source).toContain('if (!isVerified) setSection');
    expect(source).toContain('disabled={noPermission}');
  });

  it('enforces company membership and scopes vehicle documents through company vehicles', () => {
    const source = read('app/api/workspace/fleet-overview/route.ts');
    expect(source).toContain(".from('company_memberships')");
    expect(source).toContain(".eq('company_id', companyId)");
    expect(source).toContain(".from('vehicle_documents')");
    expect(source).toContain(".in('vehicle_id', vehicleIds)");
    expect(source).toContain('documentsUnavailable = Boolean(documentsResult.error)');
    expect(source).toContain('includeDocuments');
    expect(source).toContain(".select('company_id,status,role_in_company')");
    expect(source).toContain('canReadDocuments');
    expect(source).toContain('documentsRestricted');
  });

  it('restricts fleet modification to owner drivers in the driver workspace', () => {
    const source = read('app/driver/fleet/page.tsx');
    expect(source).toContain("resolveWorkspaceRole(user) === 'owner_driver'");
    expect(source).toContain('canManage={canManage}');
  });
});
