import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
const roles = read('lib/workspaceRole.ts');
const notificationsApi = read('app/api/workspace/notifications/route.ts');

describe('Driver top navigation role split', () => {
  it('keeps employed Driver execution-focused and avoids Owner Driver commercial navigation', () => {
    for (const primary of [
      "['driver-dashboard-primary', 'Dashboard', '/driver']",
      "['driver-action-centre-primary', 'Action Centre', '/driver/action-centre']",
      "['driver-jobs-primary', 'My Jobs', '/driver/jobs']",
      "['driver-diary-primary', 'Diary', '/driver/history']",
      "['driver-availability-primary', 'Availability', '/driver/availability']",
      "['driver-vehicle-primary', 'Vehicle', '/driver/vehicles']",
      "['driver-documents-primary', 'Documents', '/driver/documents']",
      "['driver-settings-primary', 'Settings', '/driver/settings']",
    ]) expect(shell).toContain(primary);

    const driverBlock = shell.slice(
      shell.indexOf('if (!ownerDriver)'),
      shell.indexOf("return composeRolePrimaryNav(groups, [", shell.indexOf('if (!ownerDriver)') + 1),
    );
    for (const commercial of ['/driver/loads', '/driver/quotes', '/driver/fleet', '/driver/returns']) {
      expect(driverBlock).not.toContain(`'${commercial}'`);
    }
  });

  it('keeps Owner Driver commercial tools while consolidating fleet resources into My Fleet', () => {
    for (const href of ['/driver/directory','/driver/nearby','/driver/returns','/driver/loads','/driver/quotes','/driver/won-work']) {
      expect(roles).toContain(`href: '${href}'`);
    }
    expect(shell).toContain("['owner-driver-my-fleet-primary', 'My Fleet', '/driver/fleet']");
    expect(read('app/driver/_components/DriverFleetIntegratedNav.tsx')).toContain("'/driver/vehicles'");
    expect(read('app/driver/_components/DriverFleetIntegratedNav.tsx')).toContain("'/driver/drivers-vehicles'");
    expect(read('app/driver/_components/DriverFleetIntegratedNav.tsx')).toContain("'/driver/freight-vision'");
    expect(shell).toContain("role === 'owner_driver'");
    expect(shell).toContain("user?.canCommercialBid === true");
  });

  it('keeps Owner Driver Settings primary and business controls secondary without duplicate settings routes', () => {
    for (const label of ['Invoices','Company Profile','Drivers & Staff','Company Settings','Membership & Billing']) {
      expect(roles).toContain(`label: '${label}'`);
    }
    expect(shell).toContain("['owner-driver-settings-primary', 'Settings', '/driver/settings']");
    const owner = shell.slice(
      shell.indexOf("return composeRolePrimaryNav(groups, [", shell.indexOf('if (!ownerDriver)') + 1),
      shell.indexOf('export function composeDispatcherPrimaryNav'),
    );
    const more = owner.slice(owner.indexOf("], 'owner-driver-more', 'More', ["));
    expect(more).toContain("'/driver/finance'");
    expect(more).not.toContain("'/driver/settings'");
    expect(more).not.toContain("'/driver/drivers-vehicles'");
    expect(more).not.toContain("'/driver/freight-vision'");
    expect(more).not.toContain("'/driver/settings?section=company'");
    expect(more).not.toContain("'/driver/settings?section=overview'");
    expect(more).not.toContain("'/settings/billing'");
    expect(shell).toContain('showOwnerDriverPostLoadAction');
  });

  it('keeps notification counting server-authoritative for every workspace role', () => {
    expect(shell).toContain("fetch('/api/workspace/notifications?mode=count'");
    expect(shell).not.toContain(".from('notifications')");
    expect(notificationsApi).toContain(".eq('user_id', auth.user.id)");
  });

  it('does not introduce Super Admin coupling', () => {
    expect(shell).not.toContain('/super-admin');
  });
});
