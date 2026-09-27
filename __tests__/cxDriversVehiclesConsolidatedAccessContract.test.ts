import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/admin/fleet/resources/page.tsx'), 'utf8');
const legacyEntry = fs.readFileSync(path.join(process.cwd(), 'app/admin/drivers-vehicles/page.tsx'), 'utf8');
const workspaceRole = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');

describe('CX Drivers & Vehicles consolidated access contract', () => {
  it('presents the combined workspace as Drivers & Vehicles', () => {
    expect(source).toContain('title="Drivers & Vehicles"');
    expect(source).toContain('Drivers Register');
    expect(source).toContain('Vehicles Register');
  });

  it('keeps direct navigation to canonical registers and connected capacity surfaces', () => {
    expect(source).toContain("router.push('/admin/fleet/drivers')");
    expect(source).toContain("router.push('/admin/fleet/vehicles')");
    expect(source).toContain("router.push('/admin/fleet/positions')");
    expect(source).toContain('Vehicle Tracking');
    expect(source).toContain("router.push('/admin/live-availability')");
    expect(source).toContain("router.push('/admin/fleet/returns')");
  });

  it('routes the historical Drivers & Vehicles entry point into the consolidated resource workspace', () => {
    expect(legacyEntry).toContain("router.replace('/admin/fleet/resources')");
    expect(legacyEntry).toContain('Opening Drivers &amp; Vehicles');
  });

  it('groups carrier Drivers & Vehicles navigation around the consolidated workspace while preserving direct registers', () => {
    expect(workspaceRole).toContain("id: 'carrier-resources', label: 'Drivers & Vehicles'");
    expect(workspaceRole).toContain("href: '/admin/fleet/resources'");
    expect(workspaceRole).toContain("href: '/admin/drivers'");
    expect(workspaceRole).toContain("href: '/admin/vehicles'");
    expect(workspaceRole).toContain("href: '/admin/fleet/positions'");
  });

  it('keeps a CX-style Company Vehicles register in the consolidated workspace', () => {
    expect(source).toContain('title="Company Vehicles"');
    expect(source).toContain("columns={['Vehicle', 'Size / type', 'Year', 'Max payload', 'Assigned driver', 'Tracking', 'Documents', 'Actions']}");
    expect(source).toContain('vehicle.manufacture_year');
    expect(source).toContain('vehicle.payload_kg');
    expect(source).toContain("router.push('/admin/event-log')");
    expect(source).toContain("router.push('/admin/documents')");
  });

  it('keeps Resources selected as the consolidated operating view', () => {
    expect(source).toContain('aria-current="page"');
    expect(source).toContain('Resources</button>');
  });
});
