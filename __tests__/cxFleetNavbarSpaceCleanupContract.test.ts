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

  it('keeps Fleet actions inside the canonical Reports & Statistics card instead of a separate page header', () => {
    const cardStart = fleet.indexOf('title="Reports & Statistics"');
    const cardEnd = fleet.indexOf('<OperationalSignalStrip', cardStart);
    const card = fleet.slice(cardStart, cardEnd);
    expect(cardStart).toBeGreaterThanOrEqual(0);
    expect(card).toContain('Allocate Jobs');
    expect(card).toContain('Refresh');
    expect(fleet).not.toContain('<DashboardHomeHeader');
    expect(card).not.toContain('>Post Load<');
    expect(card).not.toContain('>Drivers<');
    expect(card).not.toContain('>Vehicles<');
    expect(card).not.toContain('>Live Positions<');
  });

  it('retains the real Fleet routes elsewhere in the operational page', () => {
    expect(fleet).toContain("router.push('/admin/fleet/assignments')");
    expect(fleet).toContain("router.push('/admin/fleet/drivers')");
    expect(fleet).toContain("router.push('/admin/fleet/vehicles')");
    expect(fleet).toContain("router.push('/admin/fleet/positions')");
  });
});
