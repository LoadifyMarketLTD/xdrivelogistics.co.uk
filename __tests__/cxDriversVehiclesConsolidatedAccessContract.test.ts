import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/admin/fleet/resources/page.tsx'), 'utf8');
const legacyEntry = fs.readFileSync(path.join(process.cwd(), 'app/admin/drivers-vehicles/page.tsx'), 'utf8');
const workspaceRole = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');

describe('CX Drivers & Vehicles consolidated access contract', () => {
  it('presents the combined workspace as Drivers & Vehicles without duplicate register shortcuts in the header', () => {
    expect(source).toContain('title="Drivers & Vehicles"');
    expect(source).not.toContain('Drivers Register');
    expect(source).not.toContain('Vehicles Register');
  });

  it('keeps the exact CX resource-local subnavigation and leaves Live Availability / Return Journeys to the primary navbar', () => {
    expect(source).toContain('Users / Drivers</button>');
    expect(source).toContain("router.push('/admin/vehicles')}>Company Vehicles</button>");
    expect(source).toContain("router.push('/admin/fleet/positions')}>Vehicle Tracking</button>");
    const navBlock = source.slice(source.indexOf('aria-label="Drivers and vehicles workspace navigation"'), source.indexOf('{data.error'));
    expect(navBlock).not.toContain("router.push('/admin/live-availability')");
    expect(navBlock).not.toContain("router.push('/admin/fleet/returns')");
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

  it('keeps a CX-style Company Vehicles register without repeating global navigation as row actions', () => {
    expect(source).toContain('title="Company Vehicles"');
    expect(source).toContain("columns={['Vehicle', 'Size / type', 'Year', 'Max payload', 'Assigned driver', 'Tracking', 'Advertising', 'Notify when tracked', 'Documents']}");
    expect(source).toContain('vehicle.manufacture_year');
    expect(source).toContain('vehicle.payload_kg');
    expect(source).toContain('>Add Vehicle</ActionButton>');
    expect(source).toContain("router.push('/admin/vehicles')");
    expect(source).not.toContain("router.push('/admin/event-log')}>Event Log");
    expect(source).not.toContain("router.push('/admin/documents')}>Documents");
  });

  it('keeps Users / Drivers selected as the consolidated CX operating view', () => {
    expect(source).toContain('aria-selected="true"');
    expect(source).toContain('data-active="true"');
    expect(source).toContain('Users / Drivers</button>');
  });
});
