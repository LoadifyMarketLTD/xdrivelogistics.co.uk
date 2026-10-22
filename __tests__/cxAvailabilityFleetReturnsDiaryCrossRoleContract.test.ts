import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Courier Exchange live availability, fleet, return journeys and diary parity across applicable roles', () => {
  const adminAvailability = read('app/admin/live-availability/page.tsx');
  const adminFleet = read('app/admin/fleet/vehicles/page.tsx');
  const adminReturns = read('app/admin/fleet/returns/page.tsx');
  const driverAvailability = read('app/driver/availability/live/DriverAvailabilityLiveWorkspace.tsx');
  const driverFleet = read('app/driver/fleet/page.tsx');
  const driverReturns = read('app/driver/returns/page.tsx');
  const diary = read('lib/diary/canonicalDiary.ts');
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const roles = read('lib/workspaceRole.ts');
  const access = read('lib/roleCapabilities.ts');

  it('uses the exact CX live audience tabs in company availability and My Fleet', () => {
    for (const source of [adminAvailability, adminFleet]) {
      expect(source).toContain('All</button>');
      expect(source).toContain('Drivers &amp; Sub-contractors</button>');
      expect(source).toContain('Other Drivers');
    }
    expect(adminAvailability).not.toContain("parsed.tab === 'future'");
  });

  it('uses the exact CX live audience tabs in Driver / Owner Driver availability and My Fleet', () => {
    for (const label of ['All</button>', 'Drivers & Sub-contractors</button>', 'Other Drivers</button>']) {
      expect(driverAvailability).toContain(label);
    }
    expect(driverFleet).toContain('DriverAvailabilityLiveWorkspace mode="fleet"');
    expect(driverAvailability).toContain("explicitMode ?? (pathname.startsWith('/driver/fleet') ? 'fleet' : 'availability')");
    expect(roles).toContain("label: 'My Fleet', href: '/driver/fleet'");
    expect(access).toContain("{ prefix: '/driver/fleet', workspace: 'owner_operator', roles: ['owner_driver'] }");
  });

  it('uses the exact CX live return journey type tabs and top actions', () => {
    for (const source of [adminReturns, driverReturns]) {
      expect(source).toContain("['all', 'All']");
      expect(source).toContain("['ad_hoc', 'Ad Hoc']");
      expect(source).toContain("['regular', 'Regular']");
      expect(source).toContain('Add Journey');
      expect(source).toContain('Our Journeys');
    }
  });

  it('uses the exact CX live nine-state Diary strip for company operational roles', () => {
    for (const label of ['All', 'Unallocated', 'Allocated', 'In Progress', 'Completed', 'Cancelled', 'Expired', 'Awaiting Feedback', 'Recent Feedback']) {
      expect(diary).toContain(`label: '${label}'`);
    }
    expect(diary).not.toContain("label: 'POD / Evidence'");
  });

  it('keeps the applicable CX modules present for Carrier, Fleet Manager, Dispatcher and Owner Driver primary navigation', () => {
    for (const marker of [
      "carrier-live-availability', 'Live Availability', '/admin/live-availability'",
      "carrier-my-fleet', 'My Fleet', '/admin/fleet/vehicles'",
      "carrier-return-journeys', 'Return Journeys', '/admin/fleet/returns'",
      "fleet-live-availability', 'Live Availability', '/admin/live-availability'",
      "fleet-my-fleet', 'My Fleet', '/admin/fleet/vehicles'",
      "fleet-return-journeys', 'Return Journeys', '/admin/fleet/returns'",
      "dispatcher-unallocated-primary', 'Unallocated', '/admin/fleet/assignments'",
      "dispatcher-active-jobs-primary', 'Active Jobs', '/admin/fleet/active-jobs'",
      "dispatcher-positions-primary', 'Live Positions', '/admin/fleet/positions'",
      "owner-driver-live-availability-primary', 'Live Availability', '/driver/availability/live'",
      "owner-driver-my-fleet-primary', 'My Fleet', '/driver/fleet'",
      "owner-driver-returns-primary', 'Return Journeys', '/driver/returns'",
    ]) expect(shell).toContain(marker);
  });
});
