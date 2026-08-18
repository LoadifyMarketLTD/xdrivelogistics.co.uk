import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guardedSources = [
  'app/components/workspace/CarrierOperationsDashboardHome.tsx',
  'app/components/workspace/FleetControlDashboardHome.tsx',
  'app/components/workspace/MemberDirectoryPage.tsx',
  'app/components/workspace/DriverJobSheetPanel.tsx',
  'app/components/workspace/AccountSectionNav.tsx',
  'app/customer/CustomerDashboardHome.tsx',
  'app/customer/CustomerOperationalPages.tsx',
  'app/customer/diary/page.tsx',
  'app/driver/page.tsx',
  'app/admin/fleet/active-jobs/FleetActiveJobsPage.tsx',
  'app/admin/fleet/assignments/page.tsx',
  'app/admin/fleet/vehicles/page.tsx',
];

describe('workspace operational typography', () => {
  it('does not introduce 8–9px operational text in takeover/redesign sources', () => {
    const violations: string[] = [];
    for (const file of guardedSources) {
      const absolute = path.join(process.cwd(), file);
      expect(fs.existsSync(absolute), `Expected guarded source to exist: ${file}`).toBe(true);
      const source = fs.readFileSync(absolute, 'utf8');
      if (/font(?:-size|Size)\s*[:=]\s*['"]?(?:8|8\.5|9)px\b/i.test(source)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });
});
