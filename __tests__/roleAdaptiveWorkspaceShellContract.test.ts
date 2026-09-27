import fs from 'node:fs';
import path from 'node:path';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
const driverShell = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverTopWorkspaceShell.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'), 'utf8');
const adminSettings = fs.readFileSync(path.join(process.cwd(), 'app/admin/settings/page.tsx'), 'utf8');

describe('role-adaptive workspace shell contract', () => {
  it('keeps one Post Load action for Customer and Broker instead of duplicating it inside nav menus', () => {
    expect(shell).not.toContain("id: 'broker-post-load'");
    expect(shell).not.toContain("id: 'customer-post-load'");
    expect(shell).toContain('definition.primaryAction');
  });

  it('exposes logout in both shared and driver shells', () => {
    expect(shell).toContain('onClick={() => void logout()}');
    expect(driverShell).toContain('const { user, logout } = useAuth();');
    expect(driverShell).toContain('onClick={() => void logout()}');
  });

  it('resolves Driver vs Owner Driver navigation from the canonical workspace role', () => {
    expect(driverShell).toContain('const resolvedRole = resolveWorkspaceRole(user);');
    expect(driverShell).toContain("resolvedRole === 'owner_driver'");
  });

  it('maps settings to the actual workflow role instead of treating every admin user as fleet', () => {
    for (const role of ['carrier', 'fleet', 'dispatcher', 'finance', 'compliance', 'viewer']) {
      expect(adminSettings).toContain(`'${role}' as const`);
    }
    expect(settings).toContain("companyProfileRoles: readonly RoleMode[] = ['customer', 'broker', 'owner', 'carrier']");
    expect(settings).toContain("billingRoles: readonly RoleMode[] = ['customer', 'broker', 'owner', 'carrier']");
  });
});
