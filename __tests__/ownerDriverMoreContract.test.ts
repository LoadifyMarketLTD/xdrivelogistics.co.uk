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

const INTEGRATED_ROUTES = [
  '/driver/jobs',
  '/driver/won-work',
  '/driver/availability',
  '/driver/load-alerts',
  '/driver/nearby',
  '/driver/finance',
  '/driver/documents',
  '/driver/messages',
] as const;

describe('Owner Driver integrated secondary navigation contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const owner = shell.slice(
    shell.indexOf('export function composeDriverPrimaryNav'),
    shell.indexOf('export function composeDispatcherPrimaryNav'),
  );

  it('integrates former More destinations into the primary Owner Driver navigation', () => {
    for (const href of INTEGRATED_ROUTES) expect(owner).toContain(`'${href}'`);
    expect(owner).toContain("['owner-driver-jobs-primary', 'My Jobs', '/driver/jobs']");
    expect(owner).toContain("['owner-driver-availability-primary', 'Availability & Schedule', '/driver/availability']");
    expect(owner).toContain("['owner-driver-alerts-primary', 'Load Matching & Alerts', '/driver/load-alerts']");
    expect(owner).toContain("['owner-driver-finance-primary', 'Finance & Invoices', '/driver/finance']");
    expect(owner).toContain("return ownerNav.filter((group) => group.id !== 'owner-driver-more')");
  });

  it('keeps Live Availability distinct from schedule and matching tools', () => {
    expect(owner).toContain("['owner-driver-live-availability-primary', 'Live Availability', '/driver/availability/live']");
    expect(owner).toContain("['owner-driver-availability-primary', 'Availability & Schedule', '/driver/availability']");
    expect(owner).toContain("['owner-driver-nearby-primary', \"Who's Nearby\", '/driver/nearby']");
  });

  it('keeps every integrated route real and permitted', () => {
    for (const href of INTEGRATED_ROUTES) {
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
