import fs from 'node:fs';
import path from 'node:path';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
const fleet = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/FleetControlDashboardHome.tsx'), 'utf8');

describe('carrier navbar and Fleet header space cleanup', () => {
  it('keeps one compact workspace identity and suppresses redundant carrier company text', () => {
    expect(shell).toContain('top-workspace-shell__identity');
    expect(shell).toContain('<span>{definition.label}</span>');
    expect(shell).toContain("role !== 'customer' && !CARRIER_NAV_ROLES.has(role) ? <strong>{companyName}</strong> : null");
  });

  it('keeps only operational Fleet page actions that are not duplicated in the main navigation', () => {
    const headerStart = fleet.indexOf('title="My Fleet"');
    const headerEnd = fleet.indexOf('/>', headerStart);
    const header = fleet.slice(headerStart, headerEnd);
    expect(headerStart).toBeGreaterThanOrEqual(0);
    expect(header).toContain('Allocate Jobs');
    expect(header).toContain('Refresh');
    expect(header).not.toContain('>Post Load<');
    expect(header).not.toContain('>Drivers<');
    expect(header).not.toContain('>Vehicles<');
    expect(header).not.toContain('>Live Positions<');
  });

  it('retains the real Fleet routes elsewhere in the operational page', () => {
    expect(fleet).toContain("router.push('/admin/fleet/assignments')");
    expect(fleet).toContain("router.push('/admin/fleet/drivers')");
    expect(fleet).toContain("router.push('/admin/fleet/vehicles')");
    expect(fleet).toContain("router.push('/admin/fleet/positions')");
  });
});
