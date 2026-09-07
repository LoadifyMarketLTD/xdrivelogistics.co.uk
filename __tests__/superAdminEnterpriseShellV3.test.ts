import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const contract = source('docs/super-admin/MASTER_CONTRACT_FINAL.md');
const workspace = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');
const layout = source('app/super-admin/layout.tsx');
const visualContract = source('app/super-admin/super-admin-visual-contract.css');
const shell = source('app/super-admin/_components/SuperAdminCardNavigationShell.tsx');
const sidebar = source('app/super-admin/_components/SuperAdminSidebar.tsx');
const topbar = source('app/super-admin/_components/SuperAdminTopbar.tsx');
const css = source('app/super-admin/_components/SuperAdminCardNavigationShell.module.css');

describe('MASTER CONTRACT FINAL v3 — enterprise shell', () => {
  it('makes v3 and the CargoMax + ShipNow blueprint canonical', () => {
    expect(contract).toContain('MASTER CONTRACT FINAL v3');
    expect(contract).toContain('MASTER CONTRACT FINAL v2 is cancelled');
    expect(contract).toContain('SUPER_ADMIN_CARGOMAX_SHIPNOW_ENTERPRISE_EXECUTION_BLUEPRINT_2026-09-07.md');
    expect(contract).toContain('ShipNow is the licensed Envato Elements design asset');
  });

  it('removes cancelled v2 runtime layers from the protected layout', () => {
    expect(layout).not.toContain('super-admin-v2-icon-enforcement.css');
    expect(layout).not.toContain('super-admin-master-contract.css');
    expect(visualContract).toContain('enterprise visual contract v3');
  });

  it('uses the XDrive-native enterprise sidebar and topbar', () => {
    expect(shell).toContain("import SuperAdminSidebar from './SuperAdminSidebar'");
    expect(shell).toContain("import SuperAdminTopbar from './SuperAdminTopbar'");
    expect(shell).not.toContain('<SuperAdminNavbar');
    expect(sidebar).toContain('XDrive');
    expect(sidebar).toContain('Platform Control');
    expect(sidebar).not.toContain('CargoMax');
    expect(sidebar).not.toContain('ShipNow');
  });

  it('uses Lucide icons instead of the cancelled glyph navigation', () => {
    expect(sidebar).toContain("from 'lucide-react'");
    expect(sidebar).toContain('const ICONS: Record<string, IconComponent>');
    expect(workspace).not.toContain("icon: '");
    expect(sidebar).not.toContain('⌂');
    expect(sidebar).not.toContain('⌖');
    expect(sidebar).not.toContain('⚙');
  });

  it('preserves the critical Super Admin destinations in the new hierarchy', () => {
    for (const href of [
      '/super-admin',
      '/super-admin/operations/control-centre',
      '/super-admin/search',
      '/super-admin/analytics',
      '/super-admin/health',
      '/super-admin/notifications',
      '/super-admin/marketplace',
      '/super-admin/operations/jobs',
      '/super-admin/operations/quotes',
      '/super-admin/operations/allocations',
      '/super-admin/operations/pods',
      '/super-admin/operations/fleet-positions',
      '/super-admin/fleet/vehicles',
      '/super-admin/fleet/return-journeys',
      '/super-admin/companies',
      '/super-admin/finance',
      '/super-admin/compliance/documents',
      '/super-admin/support/tickets',
      '/super-admin/settings/audit-logs',
    ]) expect(workspace).toContain(`href: '${href}'`);
  });

  it('implements persistent desktop collapse and mobile navigation fallback', () => {
    expect(shell).toContain("window.localStorage.getItem('xdrive-super-admin-sidebar-collapsed')");
    expect(shell).toContain("window.localStorage.setItem('xdrive-super-admin-sidebar-collapsed'");
    expect(shell).toContain('setMobileOpen((current) => !current)');
    expect(css).toContain('.shellCollapsed');
    expect(css).toContain('.sidebarCollapsed');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('.sidebarMobileOpen');
    expect(css).toContain('.mobileBackdrop');
  });

  it('keeps global search, Action Centre, Platform Overview and owner sign-out reachable', () => {
    expect(topbar).toContain("router.push(`/super-admin/search?q=${encodeURIComponent(query)}`)");
    expect(topbar).toContain('href="/super-admin/action-centre"');
    expect(topbar).toContain('href="/super-admin/platform"');
    expect(topbar).toContain('href="/auth/sign-out"');
    expect(topbar).toContain('Platform Owner');
  });

  it('keeps tenant workspaces outside the Platform Owner shell', () => {
    expect(workspace).not.toContain("href: '/broker'");
    expect(workspace).not.toContain("href: '/driver'");
    expect(workspace).not.toContain("href: '/customer'");
    expect(workspace).not.toContain("href: '/admin'");
  });

  it('provides accessible navigation controls and active-page semantics', () => {
    expect(sidebar).toContain('aria-label="Super Admin navigation"');
    expect(sidebar).toContain("aria-current={active ? 'page' : undefined}");
    expect(topbar).toContain('aria-label="Search platform"');
    expect(topbar).toContain("aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}");
    expect(shell).toContain('aria-label="Close Super Admin navigation"');
  });
});
