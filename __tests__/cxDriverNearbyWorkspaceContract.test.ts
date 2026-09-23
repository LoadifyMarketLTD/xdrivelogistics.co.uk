import fs from 'node:fs';
import path from 'node:path';

describe("Driver Live Availability prototype contract", () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/nearby/page.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverTopWorkspaceShell.tsx'), 'utf8');
  const api = fs.readFileSync(path.join(process.cwd(), 'app/api/availability/nearby/route.ts'), 'utf8');

  it('promotes Live Availability to the prototype navbar', () => {
    expect(shell).toContain("label: 'Live Availability', href: '/driver/nearby'");
    expect(page).toContain('driver-live-availability-prototype');
    expect(page).toContain('Live Availability');
  });

  it('uses the authorised nearby API and exchange scope only', () => {
    expect(page).toContain("fetch('/api/availability/nearby'");
    expect(page).toContain("position.scope === 'exchange'");
    expect(api).toContain("scope: 'exchange'");
  });

  it('preserves privacy boundaries', () => {
    expect(page).toContain('Privacy-rounded');
    expect(page).not.toContain('position.driver_id');
    expect(api).toContain("never the driver's identity or exact position");
  });

  it('does not fabricate capacity', () => {
    expect(page).toContain('position.payload_kg != null');
    expect(page).toContain('position.pallets_capacity != null');
    expect(page).toContain('Capacity not published');
  });
});
