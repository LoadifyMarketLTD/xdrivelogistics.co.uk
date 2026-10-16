import fs from 'node:fs';
import path from 'node:path';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
const roles = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');

describe('compact carrier navbar contract', () => {
  it('keeps only the useful carrier header actions visible', () => {
    expect(shell).toContain('showCarrierPostLoadAction');
    expect(shell).toContain('POST LOAD');
    expect(shell).toContain('top-workspace-notification');
    expect(shell).toContain('Sign out');
    expect(shell).not.toContain('>Messages</button>');
  });

  it('removes redundant carrier header shortcuts', () => {
    expect(shell).not.toContain('showWorkspaceContext');
    expect(shell).not.toContain('carrierBookDirectHref');
    expect(shell).not.toContain('SharedContextControls navigation=');
    expect(shell).toContain('!CARRIER_NAV_ROLES.has(role)');
  });

  it('keeps distinct secondary carrier functions under More without duplicating hub-owned routes', () => {
    expect(shell).toContain("id: 'action-centre', label: 'Action Centre', href: '/admin/action-centre'");
    expect(shell).toContain("'/admin/bulk-import'");
    expect(shell).toContain("'/admin/invoices'");
    expect(shell).toContain('const carrierHubOwnedHrefs = new Set([');
    expect(shell).toContain("'/admin/won-work'");
    expect(shell).toContain("'/admin/fleet/drivers'");
    expect(shell).toContain("'/admin/fleet/vehicles'");
    expect(shell).toContain("'/admin/settings/billing'");
    expect(shell).toContain('...carrierHubOwnedHrefs');
    expect(roles).toContain("href: '/admin/settings/billing'");
    expect(shell).not.toContain("'/settings/billing'");
  });

  it('suppresses the duplicate Find Loads primary action for carrier roles', () => {
    expect(shell).toContain('!CARRIER_NAV_ROLES.has(role) &&');
    expect(shell).toContain('definition.primaryAction');
  });
});
