import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Live Availability CX filter refinement', () => {
  const driver = read('app/driver/availability/live/DriverAvailabilityLiveWorkspace.tsx');
  const nearby = read('app/driver/nearby/page.tsx');
  const admin = read('app/admin/live-availability/page.tsx');
  const postcodeRoute = read('app/api/location/postcode-area/route.ts');

  it('removes unnecessary descriptive prose from the driver search rail', () => {
    expect(driver).not.toContain('OFF by default. Maximum 8 hours');
    expect(driver).not.toContain('Only you. Your position');
    expect(driver).not.toContain('Who may use this position?');
    expect(driver).toContain('<span>Visibility</span>');
    expect(driver).toContain('<span>Auto-off</span>');
    expect(driver).not.toContain('availabilityLabel={');
    expect(driver).not.toContain('headerActions={');
    expect(driver).toContain('driver-live-topbar-actions');
  });

  it('uses the canonical vehicle-size taxonomy even when there are zero live positions', () => {
    expect(driver).toContain('marketplaceVehicleSizeOptions');
    expect(nearby).toContain('marketplaceVehicleSizeOptions');
    expect(admin).toContain('marketplaceVehicleSizeOptions');
    for (const source of [driver, nearby, admin]) {
      expect(source).toContain('Any vehicle');
    }
    expect(driver).toContain('option.label');
    expect(nearby).toContain('option.label');
    expect(admin).toContain('...nearbyVehicleTypes');
    for (const source of [driver, nearby, admin]) {
      expect(source).toContain('AVAILABILITY_BODY_TYPE_OPTIONS');
      expect(source).toContain('Any body');
    }
    const canonical = read('lib/availability/canonicalAvailability.ts');
    for (const body of ['Box', 'Curtain Side', 'Double Deck', 'Dropside', 'Flatbed', 'High Roof', 'Low Loader', 'Panel', 'Refrigerated', 'Side Loader', 'Tanker', 'Temperature Controlled', 'Tilt', 'Tipper', 'Trailer', 'Vehicle Transporter']) {
      expect(canonical).toContain(`label: '${body}'`);
    }
  });

  it('identifies a postcode/outcode area while the user enters it through an XDrive same-origin endpoint', () => {
    for (const source of [driver, nearby, admin]) {
      expect(source).toContain('/api/location/postcode-area');
      expect(source).not.toContain('https://api.postcodes.io');
    }
    expect(postcodeRoute).toContain('https://api.postcodes.io');
    expect(postcodeRoute).toContain('admin_district');
    expect(postcodeRoute).toContain('region');
    expect(driver).toContain('driver-live-postcode-area');
    expect(nearby).toContain('driver-live-postcode-area');
    expect(admin).toContain('workspace-postcode-area');
  });

  it('removes redundant privacy prose from Whos Nearby map', () => {
    expect(nearby).not.toContain('Privacy-rounded exchange availability. Exact driver coordinates remain protected.');
  });
});
