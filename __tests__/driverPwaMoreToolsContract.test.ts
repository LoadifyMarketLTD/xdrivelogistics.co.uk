import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Driver PWA More operational tools', () => {
  it('keeps More subpages inside the installable PWA navigation scope', () => {
    const more = source('app/m/driver/more/page.tsx');
    const nav = source('app/m/driver/DriverMobileNavigation.tsx');
    for (const route of [
      '/m/driver/availability', '/m/driver/return-journeys',
      '/m/driver/messages', '/m/driver/settings', '/m/driver/documents',
    ]) {
      expect(more).toContain(route);
      expect(nav).toContain(route);
    }
  });

  it('loads and saves driver availability through browser-approved driver identity', () => {
    const page = source('app/m/driver/availability/page.tsx');
    const endpoint = source('app/api/driver/availability-profile/route.ts');
    expect(page).toContain("fetch('/api/driver/availability-profile'");
    expect(page).toContain("method: 'PUT'");
    expect(page).toContain('destinationPriorityEnabled');
    expect(page).toContain('destinationRadiusMiles');
    expect(page).not.toContain('/api/driver/availability-presence');
    expect(endpoint).toContain('requireActiveWebDriver(request)');
    expect(endpoint).toContain(".eq('user_id', context.userId)");
    expect(endpoint).toContain(".eq('app_access', true)");
  });

  it('uses the atomic return journey action with a driver-scoped server context', () => {
    const page = source('app/m/driver/return-journeys/page.tsx');
    const endpoint = source('app/api/driver/web/resources/route.ts');
    expect(page).toContain("action: 'save_return_journey'");
    expect(page).toContain("fetch('/api/driver/web/resources'");
    expect(page).toContain('new Date(form.availableFrom)');
    expect(page).toContain('new Date(form.availableTo)');
    expect(endpoint).toContain("'save_return_journey'");
    expect(endpoint).toContain("replace_driver_return_journey_canonical");
    expect(endpoint).toContain('p_driver_id: context.driverId');
  });

  it('lists private inbox messages and marks read only for the authenticated user', () => {
    const page = source('app/m/driver/messages/page.tsx');
    const endpoint = source('app/api/driver/web/resources/route.ts');
    expect(page).toContain('result.resources.notifications');
    expect(page).toContain("action: 'mark_notification_read'");
    expect(endpoint).toContain(".eq('user_id', context.userId)");
    expect(endpoint).toContain("action === 'mark_notification_read'");
    expect(page).not.toContain('driver_mobile_device_sessions');
  });

  it('keeps finance access for owners only in PWA settings', () => {
    const settings = source('app/m/driver/settings/page.tsx');
    expect(settings).toContain("driver_type === 'owner_driver'");
    expect(settings).toContain("owner ? 'Owner Driver' : 'Company Driver'");
    expect(settings).not.toContain('/driver/finance');
  });
});
