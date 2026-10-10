import fs from 'node:fs';
import path from 'node:path';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const context = {
  workspaceRole: 'owner_driver' as const,
  driverId: 'owner-driver-1',
  canCommercialBid: true,
  driverStatus: 'active',
  appAccess: true,
  accountStatus: 'active',
  companyStatus: 'active',
};

describe('Owner Driver integrated navigation after Preview 656', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');

  it('keeps secondary work, availability and business destinations directly reachable', () => {
    const block = shell.slice(shell.indexOf('const ownerNav = composeRolePrimaryNav(groups, ['), shell.indexOf('export function composeDispatcherPrimaryNav'));
    for (const marker of [
      'Availability & Schedule',
      '/driver/won-work',
      'Load Matching & Alerts',
      '/driver/nearby',
      '/driver/documents',
      'Finance & Invoices',
      '/driver/messages',
    ]) expect(block).toContain(marker);
    expect(block).toContain("return ownerNav.filter((group) => group.id !== 'owner-driver-more')");
  });

  it('keeps every integrated Owner Driver route authorised', () => {
    for (const href of ['/driver/jobs','/driver/availability','/driver/won-work','/driver/load-alerts','/driver/nearby','/driver/documents','/driver/finance','/driver/messages']) {
      expect(isCapabilityAllowedForPath(href, 'driver', context), href).toBe(true);
    }
  });

  it('retires the duplicated legacy /driver/more card page', () => {
    expect(read('app/driver/more/page.tsx')).toContain("redirect('/driver')");
  });
});
