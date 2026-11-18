import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('role-scoped billing and support routing', () => {
  const settings = read('app/components/workspace/RoleSettingsWorkspace.tsx');
  const nav = read('lib/workspaceRole.ts');

  it('keeps billing pages inside each commercial workspace shell', () => {
    for (const page of [
      'app/admin/settings/billing/page.tsx',
      'app/broker/settings/billing/page.tsx',
      'app/customer/settings/billing/page.tsx',
      'app/driver/settings/billing/page.tsx',
    ]) {
      expect(existsSync(join(process.cwd(), page)), page).toBe(true);
      expect(read(page)).toContain("../../../settings/billing/page");
    }
  });

  it('routes canonical workspace navigation to the role-scoped billing pages', () => {
    expect(nav).toContain("href: '/driver/settings/billing'");
    expect(nav).toContain("href: '/admin/settings/billing'");
    expect(nav).toContain("href: '/broker/settings/billing'");
    expect(nav).toContain("href: '/customer/settings/billing'");
  });

  it('keeps Settings billing and support actions inside the current workspace', () => {
    for (const route of [
      "billing: '/driver/settings/billing'",
      "billing: '/admin/settings/billing'",
      "billing: '/broker/settings/billing'",
      "billing: '/customer/settings/billing'",
      "support: '/driver/support'",
      "support: '/admin/support'",
      "support: '/broker/support'",
      "support: '/customer/support'",
    ]) expect(settings).toContain(route);

    expect(settings).toContain('router.push(routes.billing!)');
    expect(settings).toContain('router.push(routes.support!)');
    expect(settings).not.toContain("router.push('/settings/billing')");
    expect(settings).not.toContain("router.push('/help')");
  });

  it('does not change the protected Owner Driver shell or stylesheet from this routing slice', () => {
    expect(read('app/driver/layout.tsx')).toContain('DriverTopWorkspaceShell');
    expect(read('app/driver/layout.tsx')).toContain('driver-full-prototype.css');
  });
});
