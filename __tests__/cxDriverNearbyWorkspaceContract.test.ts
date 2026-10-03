import fs from 'node:fs';
import path from 'node:path';

describe("Driver Who's Nearby workspace contract", () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/nearby/page.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');
  const api = fs.readFileSync(path.join(process.cwd(), 'app/api/availability/nearby/route.ts'), 'utf8');

  it("keeps Who's Nearby distinct from the Driver's own Availability workspace", () => {
    expect(shell).toContain("label: 'Availability', href: '/driver/availability'");
    expect(shell).toContain("label: \"Who's Nearby\", href: '/driver/nearby'");
    expect(page).toContain('driver-nearby-canonical');
    expect(page).toContain('<DriverWorkspaceShell');
    expect(page).toContain("Who's Nearby");
    expect(page).toContain('exchange-visible nearby vehicle capacity');
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
