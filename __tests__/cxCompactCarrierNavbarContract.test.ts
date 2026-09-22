import fs from 'node:fs';
import path from 'node:path';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');

describe('compact carrier navbar contract', () => {
  it('keeps only the useful carrier header actions visible', () => {
    expect(shell).toContain('showCarrierPostLoadAction');
    expect(shell).toContain('+ Post Load');
    expect(shell).toContain('top-workspace-notification');
    expect(shell).toContain('Sign out');
  });

  it('removes redundant carrier header shortcuts', () => {
    expect(shell).not.toContain('showWorkspaceContext');
    expect(shell).not.toContain('carrierBookDirectHref');
    expect(shell).not.toContain('SharedContextControls navigation=');
    expect(shell).toContain('!CARRIER_NAV_ROLES.has(role)');
  });

  it('keeps secondary Action Centre access under More instead of occupying header space', () => {
    expect(shell).toContain("id: 'action-centre', label: 'Action Centre', href: '/admin/action-centre'");
    expect(shell).toContain("'/admin/invoices'");
    expect(shell).toContain("'/admin/fleet/drivers'");
  });

  it('suppresses the duplicate Find Loads primary action for carrier roles', () => {
    expect(shell).toContain('!CARRIER_NAV_ROLES.has(role) &&');
    expect(shell).toContain('definition.primaryAction');
  });
});
