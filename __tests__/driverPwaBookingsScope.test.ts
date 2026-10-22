import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { driverJobStatusesForScope } from '../lib/jobs/jobLifecyclePresentation';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Driver PWA bookings lifecycle scope', () => {
  it('includes awards, active execution and delivered jobs waiting for POD', () => {
    const bookings = driverJobStatusesForScope('bookings');
    expect(bookings).not.toBeNull();
    for (const stage of [
      'awarded', 'allocated', 'accepted', 'on_my_way',
      'on_site_pickup', 'loaded', 'in_transit',
      'on_site_delivery', 'delivered',
    ]) {
      expect(bookings).toContain(stage);
    }
    for (const stage of ['draft', 'posted', 'cancelled', 'invoiced', 'paid']) {
      expect(bookings).not.toContain(stage);
    }
    expect(new Set(bookings).size).toBe(bookings?.length);
  });

  it('keeps existing active and completed scopes intact', () => {
    expect(driverJobStatusesForScope('active')).not.toContain('allocated');
    expect(driverJobStatusesForScope('completed')).toContain('completed');
    expect(driverJobStatusesForScope('all')).toBeNull();
  });

  it('wires the PWA booking list to the new server-filtered scope', () => {
    expect(source('app/m/driver/bookings/page.tsx'))
      .toContain('/api/driver/web/jobs?scope=bookings');
    const server = source('app/api/driver/web/jobs/route.ts');
    expect(server).toContain('driverJobStatusesForScope(scope)');
    expect(server).toContain("scope === 'bookings'");
    expect(server).toContain(".eq('assigned_driver_id', driver.driverId)");
  });
});
