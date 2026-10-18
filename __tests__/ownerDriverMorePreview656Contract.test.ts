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
  ownerDriverWorkspace: true,
};

describe('Owner Driver integrated navigation after IA consolidation', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');

  it('keeps only secondary availability and business tools in More', () => {
    const block = shell.slice(
      shell.indexOf("return composeRolePrimaryNav(groups, [", shell.indexOf('if (!ownerDriver)') + 1),
      shell.indexOf('export function composeDispatcherPrimaryNav'),
    );
    const more = block.slice(block.indexOf("], 'owner-driver-more', 'More', ["));
    for (const marker of [
      '/driver/availability',
      '/driver/load-alerts',
      '/driver/nearby',
      '/driver/documents',
      '/driver/finance',
      '/driver/messages',
      '/driver/event-log',
    ]) expect(more).toContain(marker);

    for (const removedDuplicate of [
      '/driver/won-work',
      '/driver/freight-vision',
      '/driver/drivers-vehicles',
      '/driver/settings',
    ]) expect(more).not.toContain(removedDuplicate);
  });

  it('keeps every retained Owner Driver secondary route authorised', () => {
    for (const href of ['/driver/availability','/driver/load-alerts','/driver/nearby','/driver/documents','/driver/finance','/driver/messages','/driver/event-log']) {
      expect(isCapabilityAllowedForPath(href, 'driver', context), href).toBe(true);
    }
  });

  it('keeps fleet detail routes inside the My Fleet sub-workspace', () => {
    const fleetNav = read('app/driver/_components/DriverFleetIntegratedNav.tsx');
    for (const href of ['/driver/fleet','/driver/vehicles','/driver/drivers-vehicles','/driver/freight-vision']) {
      expect(fleetNav).toContain(`href: '${href}'`);
    }
  });

  it('retires the duplicated legacy /driver/more card page', () => {
    expect(read('app/driver/more/page.tsx')).toContain("redirect('/driver')");
  });
});
