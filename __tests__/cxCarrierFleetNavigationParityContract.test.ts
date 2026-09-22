import fs from 'node:fs';
import path from 'node:path';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
const roles = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');

describe('CX-close carrier and fleet top navigation', () => {
  it('keeps the carrier primary navigation in the exact CX operating sequence', () => {
    const carrierStart = shell.indexOf("const direct: Array<[string, string, string]> = [");
    const carrierEnd = shell.indexOf("];", carrierStart);
    const carrierDirect = shell.slice(carrierStart, carrierEnd);
    const sequence = [
      "['carrier-dashboard', 'Dashboard', '/admin']",
      "['carrier-directory', 'Directory', '/admin/marketplace/directory']",
      "['carrier-live-availability', 'Live Availability', '/admin/live-availability']",
      "['carrier-my-fleet', 'My Fleet', '/admin/fleet']",
      "['carrier-return-journeys', 'Return Journeys', '/admin/fleet/returns']",
      "['carrier-loads', 'Loads', '/admin/marketplace']",
      "['carrier-quotes', 'Quotes', '/admin/exchange-quotes']",
      "['carrier-diary', 'Diary', '/admin/diary']",
      "['carrier-freight-vision', 'Freight Vision', '/admin/freight-vision']",
      "['carrier-drivers-vehicles', 'Drivers & Vehicles', '/admin/fleet/resources']",
    ];
    let cursor = -1;
    for (const item of sequence) {
      const next = carrierDirect.indexOf(item);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(carrierDirect).not.toContain("'Finance'");
    expect(carrierDirect).not.toContain("'Drivers', '/admin/fleet/drivers'");
    expect(shell).toContain("label: 'More'");
  });

  it('keeps secondary XDrive modules accessible under More rather than removing them', () => {
    expect(shell).toContain("'/admin/invoices'");
    expect(shell).toContain("'/admin/fleet/drivers'");
    expect(shell).toContain("'/admin/jobs'");
    expect(shell).toContain("'/admin/fleet/vehicles'");
    expect(shell).toContain("'/admin/documents'");
    expect(shell).toContain("'/admin/event-log'");
    expect(shell).toContain("'/admin/settings'");
  });

  it('keeps Fleet My Fleet and Drivers & Vehicles as separate destinations', () => {
    expect(shell).toContain("['fleet-my-fleet', 'My Fleet', '/admin/fleet/vehicles']");
    expect(shell).toContain("['fleet-drivers-vehicles', 'Drivers & Vehicles', '/admin/fleet/resources']");
  });

  it('does not broaden marketplace permissions for restricted fleet_manager accounts', () => {
    const fleetCapabilityBlock = roles.slice(roles.indexOf('fleet_manager: new Set'), roles.indexOf('dispatcher: new Set'));
    expect(fleetCapabilityBlock).not.toContain("'loads.view.marketplace'");
    expect(fleetCapabilityBlock).not.toContain("'quotes.submit'");
    expect(shell).toContain("else if (role === 'fleet_manager') base = composeFleetPrimaryNav(base)");
  });

  it('preserves capability gating for Driver and Vehicle links', () => {
    expect(shell).toContain("hasWorkspaceCapability(role, 'drivers.manage')");
    expect(shell).toContain("hasWorkspaceCapability(role, 'vehicles.manage')");
  });

  it('counts recipient inbox unread rows through the server-authoritative notification boundary', () => {
    expect(shell).toContain("/api/workspace/notifications?mode=count");
    expect(shell).not.toContain(".from('notifications')");
    expect(shell).not.toContain(".from('notification_events')");
  });

  it('does not couple operational navigation to Super Admin', () => {
    expect(shell).not.toContain("router.push('/super-admin')");
  });
});
