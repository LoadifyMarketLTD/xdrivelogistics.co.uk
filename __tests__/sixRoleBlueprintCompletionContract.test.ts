import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const hrefs = (role: 'customer' | 'broker' | 'carrier_admin' | 'fleet_manager' | 'driver' | 'owner_driver') =>
  getVisibleWorkspaceNav(role).flatMap((group) => group.items.map((item) => item.href));

describe('six-role canonical blueprint completion', () => {
  it('keeps Fleet Manager operational without business ownership navigation', () => {
    const nav = hrefs('fleet_manager');
    for (const route of ['/admin/fleet/drivers','/admin/fleet/vehicles','/admin/fleet/availability','/admin/fleet/future-availability','/admin/fleet/assignments','/admin/fleet/jobs','/admin/fleet/positions','/admin/fleet/returns']) {
      expect(nav).toContain(route);
    }
  });

  it('exposes Owner Driver marketplace, own work, matching, finance, messaging and directory without fleet controls', () => {
    const nav = hrefs('owner_driver');
    for (const route of ['/driver/loads','/driver/quotes','/driver/load-alerts','/driver/availability','/driver/returns','/driver/nearby','/driver/history','/driver/finance','/driver/messages','/driver/directory','/driver/vehicles','/driver/documents']) {
      expect(nav).toContain(route);
    }
    for (const forbidden of ['/driver/availability/live','/driver/drivers','/driver/drivers-vehicles']) {
      expect(nav).not.toContain(forbidden);
    }
  });

  it('keeps employed Driver execution-only while supporting evidence capture', () => {
    const nav = hrefs('driver');
    for (const route of ['/driver/jobs','/driver/history','/driver/availability','/driver/vehicles','/driver/documents','/driver/messages']) expect(nav).toContain(route);
    for (const forbidden of ['/driver/loads','/driver/quotes','/driver/finance','/driver/load-alerts','/driver/drivers-vehicles']) expect(nav).not.toContain(forbidden);

    const execution = read('app/components/workspace/DriverJobExecutionPage.tsx');
    expect(execution).toContain('multiple hidden onChange={selectCollectionPhotos}');
    expect(execution).toContain('multiple hidden onChange={selectDeliveryPhotos}');
    expect(execution).toContain('Recipient full name');
  });
});
