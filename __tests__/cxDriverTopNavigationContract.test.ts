import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
const roles = read('lib/workspaceRole.ts');
const notificationsApi = read('app/api/workspace/notifications/route.ts');

describe('Driver top navigation role split', () => {
  it('keeps employed Driver navigation execution-first in the shared shell', () => {
    for (const primary of [
      "['driver-dashboard-primary', 'Dashboard', '/driver']",
      "['driver-jobs-primary', 'My Jobs', '/driver/jobs']",
      "['driver-diary-primary', 'Diary', '/driver/history']",
      "['driver-availability-primary', 'Availability', '/driver/availability']",
      "['driver-vehicle-primary', 'Vehicle', '/driver/vehicles']",
      "['driver-documents-primary', 'Documents', '/driver/documents']",
    ]) expect(shell).toContain(primary);
  });

  it('keeps commercial tools on Owner Driver while preserving role-aware Book Direct', () => {
    for (const href of ['/driver/directory','/driver/nearby','/driver/returns','/driver/loads','/driver/quotes','/driver/won-work']) {
      expect(roles).toContain(`href: '${href}'`);
    }
    expect(shell).toContain("role === 'owner_driver'");
    expect(shell).toContain("user?.canCommercialBid === true");
  });

  it('keeps Owner Driver business controls reachable without duplicating Settings inside More', () => {
    for (const label of ['Invoices','Company Profile','Drivers & Staff','Settings','Membership & Billing']) {
      expect(roles).toContain(`label: '${label}'`);
    }
    expect(shell).toContain("['owner-driver-drivers-vehicles-primary', 'Drivers & Vehicles', '/driver/drivers-vehicles']");
    expect(shell).toContain("['owner-driver-settings-primary', 'Settings', '/driver/settings']");
    expect(shell).toContain("'/driver/finance'");
    const owner = shell.slice(shell.indexOf('function composeDriverPrimaryNav'), shell.indexOf('function composeDispatcherPrimaryNav'));
    expect(owner).not.toContain("'/driver/settings?section=company'");
    expect(owner).not.toContain("'/driver/settings?section=overview'");
    expect(owner).not.toContain("'/settings/billing'");
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
