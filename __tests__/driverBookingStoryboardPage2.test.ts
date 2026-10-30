import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver booking storyboard page 2', () => {
  it('renders an isolated on-my-way-to-pickup page for the real lifecycle state', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("approvedScreen.number===2 && currentStatus==='on_my_way'");
    expect(source).toContain('<OnMyWayToPickupStep');
  });

  it('keeps page 2 focused on the pickup map, collection details and arrival action', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/OnMyWayToPickupStep.tsx'),'utf8');
    expect(source).toContain('On My Way to Pickup');
    expect(source).toContain('Collection Details');
    expect(source).toContain('Navigate');
    expect(source).toContain('On Site at Pickup');
  });

  it('does not retain the corrupted map attribution encoding', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/BookingRouteMap.tsx'),'utf8');
    expect(source).toContain('© OpenStreetMap contributors');
    expect(source).not.toContain('┬®');
  });
});
