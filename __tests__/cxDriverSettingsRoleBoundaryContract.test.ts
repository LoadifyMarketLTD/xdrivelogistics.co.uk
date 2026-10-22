import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/settings/page.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'), 'utf8');

describe('CX-informed Driver vs Owner Driver settings boundary', () => {
  it('does not present every signed-in driver as an Owner Driver', () => {
    expect(page).toContain("const workspaceRole = resolveWorkspaceRole(user);");
    expect(page).toContain("workspaceRole === 'owner_driver' ? 'owner' as const : 'driver' as const");
    expect(page).toContain('<RoleSettingsWorkspace role={settingsRole} />');
  });

  it('keeps personal driver settings separate from privileged billing controls while exposing company settings read-only', () => {
    expect(settings).toContain("driver: 'Driver'");
    expect(settings).toContain("const companyProfileVisible = true;");
    expect(settings).toContain("const billingRoles: readonly RoleMode[] = ['customer', 'broker', 'owner', 'carrier'];");
    expect(settings).toContain("{ label: 'My Profile', action: () => setSection('profile'), active: section === 'profile' }");
    expect(settings).toContain("{ label: 'Company Settings', action: () => setSection('company'), active: section === 'company' }");
    expect(settings).toContain("disabled={!canEditCompany}");
  });

  it('keeps Driver and Owner Driver inside the same shared Settings sidebar composition', () => {
    expect(settings).toContain('<div className="role-settings-layout">');
    expect(settings).toContain('<aside className="role-settings-nav">');
    expect(settings).not.toContain("role !== 'owner' && role !== 'driver'");
  });
});
