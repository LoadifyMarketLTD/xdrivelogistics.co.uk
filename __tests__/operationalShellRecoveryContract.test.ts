import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('operational shell and onboarding recovery contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const roles = read('lib/workspaceRole.ts');
  const driverLayout = read('app/driver/layout.tsx');
  const customer = read('app/customer/CustomerDashboardHome.tsx');
  const auth = read('app/components/AuthContext.tsx');
  const login = read('app/login/page.tsx');

  it('uses the canonical shell scope for Driver and Owner Driver', () => {
    expect(driverLayout).toContain('xdrive-operational-top-workspace xdrive-driver-workspace');
  });

  it('exposes Settings as a primary destination for every operational shell composer', () => {
    for (const marker of [
      "['carrier-settings', 'Settings', '/admin/settings']",
      "['fleet-settings', 'Settings', '/admin/settings']",
      "['customer-settings-primary', 'Settings', '/customer/settings']",
      "['broker-settings-primary', 'Settings', '/broker/settings']",
      "['owner-driver-settings-primary', 'Settings', '/driver/settings?section=overview']",
      "['driver-settings-primary', 'Settings', '/driver/settings']",
      "['dispatcher-settings-primary', 'Settings', '/admin/settings']",
      "['finance-settings-primary', 'Settings', '/admin/settings']",
      "['compliance-settings-primary', 'Settings', '/admin/settings']",
    ]) expect(shell).toContain(marker);
    expect(roles).toContain("{ id: 'fleet-settings', label: 'Settings'");
    expect(roles).toContain("{ id: 'dispatcher-settings', label: 'Settings'");
    expect(roles).toContain("{ id: 'finance-settings', label: 'Settings'");
    expect(roles).toContain("{ id: 'compliance-settings', label: 'Settings'");
  });

  it('does not duplicate Customer primary navigation as dashboard quick links', () => {
    expect(customer).not.toContain('customer-dashboard-footer-links');
    expect(customer).not.toContain('actions={');
  });

  it('routes editable pending onboarding sessions back to recovery', () => {
    expect(auth).toContain("['invited', 'draft', 'in_progress', 'request_changes']");
    expect(auth).toContain("return { success: true, route: '/onboarding/resume' }");
    expect(login).toContain('router.replace(result.route)');
  });

  it('does not fold Super Admin into the operational shell contract', () => {
    expect(shell).not.toContain('Platform owner primary navigation');
  });
});
