import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('CX My Fleet global visual parity', () => {
  const adminFleet = read('app/admin/fleet/vehicles/page.tsx');
  const driverFleet = read('app/driver/availability/live/DriverAvailabilityLiveWorkspace.tsx');
  const driverCss = read('app/driver/driver-live-availability.css');
  const typography = read('app/components/workspace/workspace-readable-typography.css');

  it('keeps company My Fleet on the common operational frame without a duplicate page header', () => {
    expect(adminFleet).toContain('workspace-board-layout xdrive-my-fleet-canonical');
    expect(adminFleet).not.toContain('<PageHeader');
    expect(adminFleet).not.toContain('eyebrow="Fleet capacity"');
  });

  it('keeps Owner Driver fleet mode on the same geometry without applying the Live Availability breakout', () => {
    expect(driverFleet).toContain('driver-live-availability-canonical--${mode}');
    expect(driverCss).toContain('.driver-live-availability-canonical--availability');
    expect(driverCss).not.toContain('.driver-live-availability-canonical--fleet{');
    expect(driverCss).toContain('grid-template-columns:var(--ws-filter-rail-w,196px) minmax(0,1fr);');
    expect(driverCss).toContain('gap:var(--ws-gap-grid,14px);');
  });

  it('uses the same readable typography and primary-map geometry in company and Owner Driver My Fleet', () => {
    expect(typography).toContain('.xdrive-my-fleet-canonical');
    expect(typography).toContain(':is(.xdrive-live-availability-page, .driver-live-availability-canonical, .xdrive-my-fleet-canonical) *');
    expect(typography).toContain('.driver-nearby-canonical, .xdrive-my-fleet-canonical)');
    expect(typography).toContain('height: clamp(430px, 48vh, 560px) !important;');
  });

  it('uses the same CX audience vocabulary in both fleet surfaces', () => {
    for (const label of ['All</button>', 'Other Drivers']) {
      expect(adminFleet).toContain(label);
      expect(driverFleet).toContain(label);
    }
    expect(adminFleet).toContain('Drivers &amp; Sub-contractors');
    expect(driverFleet).toContain('Drivers & Sub-contractors');
    expect(driverFleet).toContain("'My Fleet audience'");
  });
});
