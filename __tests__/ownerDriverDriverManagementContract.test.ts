import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav, hasWorkspaceCapability } from '../lib/workspaceRole';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

describe('owner driver driver management contract', () => {
  it('keeps driver management inside the owner-driver workspace', () => {
    expect(hasWorkspaceCapability('owner_driver', 'drivers.manage')).toBe(true);
    const hrefs = getVisibleWorkspaceNav('owner_driver').flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toContain('/driver/drivers');
    expect(isCapabilityAllowedForPath('/driver/drivers', 'driver', {
      workspaceRole: 'owner_driver',
      accountStatus: 'active',
      companyStatus: 'active',
      driverStatus: 'active',
      driverId: 'driver-1',
      appAccess: true,
    })).toBe(true);
  });

  it('does not send owner drivers into the carrier admin workspace', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/drivers-vehicles/page.tsx'), 'utf8');
    expect(page).toContain("router.push('/driver/drivers')");
    expect(page).not.toContain("router.push('/admin/drivers')");
  });
});
