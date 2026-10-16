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
  '/driver/jobs',
  '/driver/won-work',
  '/driver/availability',
  '/driver/load-alerts',
  '/driver/nearby',
  '/driver/documents',
  '/driver/finance',
  '/driver/messages',
  '/driver/event-log',
  '/driver/settings',
] as const;

describe('Owner Driver integrated secondary navigation contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const owner = shell.slice(
    shell.indexOf('export function composeDriverPrimaryNav'),
    shell.indexOf('export function composeDispatcherPrimaryNav'),
  );

  it('keeps core work primary and secondary destinations in Owner Driver More', () => {
    for (const href of SECONDARY_ROUTES) expect(owner).toContain(`'${href}'`);
    expect(owner).toContain("['owner-driver-diary-primary', 'Diary', '/driver/history']");
    expect(owner).toContain("['owner-driver-freight-vision-primary', 'Freight Vision', '/driver/freight-vision']");
    expect(owner).toContain("['owner-driver-drivers-vehicles-primary', 'Drivers & Vehicles', '/driver/drivers-vehicles']");
    expect(owner).toContain("], 'owner-driver-more', 'More', [");
    expect(owner).not.toContain("return ownerNav.filter((group) => group.id !== 'owner-driver-more')");
  });

  it('keeps Live Availability primary while schedule and matching tools remain distinct in More', () => {
    expect(owner).toContain("['owner-driver-live-availability-primary', 'Live Availability', '/driver/availability/live']");
    expect(owner).toContain("'/driver/availability'");
    expect(owner).toContain("'/driver/load-alerts'");
    expect(owner).toContain("'/driver/nearby'");
  });

  it('keeps every integrated route real and permitted', () => {
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
