import fs from 'node:fs';
import path from 'node:path';

describe("Driver Who's Nearby CX convergence contract", () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/nearby/page.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverTopWorkspaceShell.tsx'), 'utf8');
  const api = fs.readFileSync(path.join(process.cwd(), 'app/api/availability/nearby/route.ts'), 'utf8');

  it('exposes Nearby in the Driver workspace without introducing a second shell', () => {
    expect(shell).toContain("{ id: 'nearby', label: 'Nearby', href: '/driver/nearby' }");
    expect(page).toContain('DriverWorkspaceShell');
    expect(page).toContain("Who's Nearby");
  });

  it('uses the existing authorised nearby API and only renders exchange-scoped results', () => {
    expect(page).toContain("fetch('/api/availability/nearby'");
    expect(page).toContain("position.scope === 'exchange'");
    expect(api).toContain("scope: 'exchange'");
  });

  it('preserves the XDrive privacy boundary for other companies', () => {
    expect(page).toContain('privacy-rounded area');
    expect(page).toContain('exact location remain protected');
    expect(page).not.toContain('position.driver_id');
    expect(api).toContain("never the driver's identity or exact position");
  });

  it('does not fabricate unavailable vehicle capacity', () => {
    expect(page).toContain('position.payload_kg != null');
    expect(page).toContain('position.pallets_capacity != null');
    expect(page).toContain('Capacity not published');
  });
});
