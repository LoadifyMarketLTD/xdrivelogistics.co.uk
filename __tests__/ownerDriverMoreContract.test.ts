import fs from 'node:fs';
import path from 'node:path';

import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const ownerContext = {
  workspaceRole: 'owner_driver' as const,
  accountStatus: 'active',
  companyStatus: 'active',
  driverId: 'driver-owner-fixture',
  driverStatus: 'active',
  appAccess: true,
  canCommercialBid: true,
  ownerDriverWorkspace: true,
};

const SECONDARY_ROUTES = [
  '/driver/availability',
  '/driver/load-alerts',
  '/driver/nearby',
  '/driver/documents',
  '/driver/finance',
  '/driver/messages',
  '/driver/event-log',
] as const;

describe('Owner Driver integrated secondary navigation contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const owner = shell.slice(
    shell.indexOf('export function composeDriverPrimaryNav'),
    shell.indexOf('export function composeDispatcherPrimaryNav'),
  );

  it('keeps frequent work primary and More limited to secondary destinations', () => {
    for (const href of SECONDARY_ROUTES) expect(owner).toContain(`'${href}'`);
    for (const primary of [
      "['owner-driver-action-centre-primary', 'Action Centre', '/driver/action-centre']",
      "['owner-driver-directory-primary', 'Directory', '/driver/directory']",
      "['owner-driver-live-availability-primary', 'Live Availability', '/driver/availability/live']",
      "['owner-driver-my-fleet-primary', 'My Fleet', '/driver/fleet']",
      "['owner-driver-returns-primary', 'Return Journeys', '/driver/returns']",
      "['owner-driver-loads-primary', 'Loads', '/driver/loads']",
      "['owner-driver-quotes-primary', 'Quotes', '/driver/quotes']",
      "['owner-driver-jobs-primary', 'My Jobs', '/driver/jobs']",
      "['owner-driver-diary-primary', 'Diary', '/driver/history']",
      "['owner-driver-settings-primary', 'Settings', '/driver/settings']",
    ]) expect(owner).toContain(primary);
    expect(owner).not.toContain("'/driver/won-work'");
    expect(owner).not.toContain("['owner-driver-freight-vision-primary'");
    expect(owner).not.toContain("['owner-driver-drivers-vehicles-primary'");
  });

  it('keeps Live Availability primary while schedule and matching tools remain secondary', () => {
    expect(owner).toContain("['owner-driver-live-availability-primary', 'Live Availability', '/driver/availability/live']");
    expect(owner).toContain("'/driver/availability'");
    expect(owner).toContain("'/driver/load-alerts'");
    expect(owner).toContain("'/driver/nearby'");
  });

  it('keeps every retained secondary route real and permitted', () => {
    for (const href of SECONDARY_ROUTES) {
      const routePath = path.join(process.cwd(), 'app', ...href.split('/').filter(Boolean), 'page.tsx');
      expect(fs.existsSync(routePath), href).toBe(true);
      expect(isCapabilityAllowedForPath(href, null, ownerContext), href).toBe(true);
    }
  });

  it('keeps /driver/more as compatibility redirect only', () => {
    const legacy = read('app/driver/more/page.tsx');
    expect(legacy).toContain("redirect('/driver')");
  });
});
