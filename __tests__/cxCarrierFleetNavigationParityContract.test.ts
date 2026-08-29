import fs from 'node:fs';
import path from 'node:path';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
const roles = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');

describe('CX-close carrier and fleet top navigation', () => {
  it('promotes the carrier modules that CX exposes as primary navigation', () => {
    for (const label of [
      'Dashboard',
      'Directory',
      'Live Availability',
      'My Fleet',
      'Return Journeys',
      'Loads',
      'Quotes',
      'Diary',
      'Freight Vision',
      'Finance',
      'Drivers & Vehicles',
      'Drivers',
    ]) {
      expect(shell).toContain(`'${label}'`);
    }
    expect(shell).toContain("label: 'More'");
  });

  it('keeps secondary XDrive modules accessible under More rather than removing them', () => {
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

  it('counts recipient inbox unread rows, not delivery queue failures', () => {
    expect(shell).toContain(".from('notifications')");
    expect(shell).toContain(".eq('user_id', user.id)");
    expect(shell).toContain(".is('read_at', null)");
    expect(shell).not.toContain(".from('notification_events')");
  });

  it('does not couple operational navigation to Super Admin', () => {
    expect(shell).not.toContain("router.push('/super-admin')");
  });
});
