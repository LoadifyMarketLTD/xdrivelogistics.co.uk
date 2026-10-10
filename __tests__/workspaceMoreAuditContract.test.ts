import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeDriverPrimaryNav } from '../app/components/workspace/TopWorkspaceShell';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';
import { getVisibleWorkspaceNav, type WorkspaceRole } from '../lib/workspaceRole';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const activeContext = (workspaceRole: WorkspaceRole) => ({
  workspaceRole,
  accountStatus: 'active',
  companyStatus: 'active',
  driverId: workspaceRole === 'driver' || workspaceRole === 'owner_driver' ? 'driver-fixture' : null,
  driverStatus: workspaceRole === 'driver' || workspaceRole === 'owner_driver' ? 'active' : null,
  appAccess: workspaceRole === 'driver' || workspaceRole === 'owner_driver' ? true : null,
  canCommercialBid: workspaceRole === 'owner_driver',
});

describe('workspace More audit contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const css = read('app/components/workspace/top-workspace-shell.css');

  it('keeps More above the workspace body instead of clipping it', () => {
    expect(css).toContain('position: fixed;');
    expect(css).toContain('overflow-y: auto;');
  });

  it('keeps Owner Driver More limited to sole-trader secondary tools', () => {
    const nav = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    const more = nav.find((group) => group.id === 'owner-driver-more');
    expect(more?.items.map((item) => item.href)).toEqual([
      '/driver/load-alerts',
      '/driver/nearby',
      '/driver/messages',
      '/driver/vehicles',
      '/driver/finance',
      '/driver/documents',
      '/driver/settings/billing',
      '/driver/settings',
    ]);
  });

  it('keeps retained Owner Driver More routes permitted', () => {
    for (const pathname of ['/driver/load-alerts','/driver/nearby','/driver/messages','/driver/vehicles','/driver/finance','/driver/documents','/driver/settings/billing','/driver/settings']) {
      expect(isCapabilityAllowedForPath(pathname, 'driver', activeContext('owner_driver')), pathname).toBe(true);
    }
  });

  it('keeps fleet-only Driver routes outside Owner Driver', () => {
    for (const pathname of ['/driver/availability/live','/driver/drivers','/driver/drivers-vehicles']) {
      expect(isCapabilityAllowedForPath(pathname, 'driver', activeContext('owner_driver')), pathname).toBe(false);
    }
    const owner = shell.slice(shell.indexOf('function composeDriverPrimaryNav'), shell.indexOf('function composeDispatcherPrimaryNav'));
    expect(owner).not.toContain('My Fleet');
    expect(owner).not.toContain('Drivers & Vehicles');
  });
});
