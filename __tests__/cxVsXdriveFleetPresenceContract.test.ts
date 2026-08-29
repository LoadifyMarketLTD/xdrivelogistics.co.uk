import fs from 'node:fs';
import path from 'node:path';

describe('CX vs XDrive Fleet availability presence contract', () => {
  const hook = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/useFleetAvailabilityPresence.ts'),
    'utf8',
  );
  const liveAvailability = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/live-availability/page.tsx'),
    'utf8',
  );
  const availability = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/fleet/availability/page.tsx'),
    'utf8',
  );
  const drivers = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/fleet/drivers/page.tsx'),
    'utf8',
  );
  const vehicles = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/fleet/vehicles/page.tsx'),
    'utf8',
  );

  it('reads availability through the authenticated server boundary', () => {
    expect(hook).toContain("fetch('/api/availability/nearby'");
    expect(hook).toContain('Authorization: `Bearer ${token}`');
    expect(hook).not.toContain(".from('driver_availability_presence')");
  });

  it('accepts only exact own-Fleet positions and rejects Exchange positions in the hook', () => {
    expect(hook).toContain("if (row.scope !== 'fleet') return [];");
    expect(hook).toContain('rowCompanyId !== companyId');
    expect(hook).toContain('driverId');
    expect(hook).not.toContain("scope === 'exchange'");
  });

  it('keeps active-job tracking and idle availability as separate complementary contracts', () => {
    expect(liveAvailability).toContain('useFleetAvailabilityPresence(data.companyId)');
    expect(liveAvailability).toContain('for (const location of data.locations)');
    expect(liveAvailability).toContain('for (const point of presence.points)');
    expect(liveAvailability).toContain('30_000');
  });

  it('uses the same presence source in Fleet availability, driver and vehicle registers', () => {
    expect(availability).toContain('useFleetAvailabilityPresence(data.companyId)');
    expect(drivers).toContain('useFleetAvailabilityPresence(data.companyId)');
    expect(vehicles).toContain('useFleetAvailabilityPresence(data.companyId)');
    expect(vehicles).toContain("value={availabilityLabel}");
    expect(vehicles).not.toContain('value="Not exposed"');
  });
});
