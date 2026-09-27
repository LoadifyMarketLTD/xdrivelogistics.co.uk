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

  it('keeps the desktop sidebar continuous for the full viewport while page content scrolls', () => {
    expect(css).toContain('position: fixed;');
    expect(css).toContain('inset: 0 auto 0 0;');
    expect(css).toContain('height: 100dvh;');
    expect(css).toContain('width: var(--sa-v3-sidebar);');
    expect(css).toContain('grid-column: 2;');
    expect(css).toContain('width: var(--sa-v3-sidebar-collapsed);');
  });

  it('gives the entire sidebar a finished enterprise visual hierarchy', () => {
    expect(css).toContain('radial-gradient(circle at 14% 0%');
    expect(css).toContain('linear-gradient(180deg, #0B2F6B 0%, #09265A 58%, #071F4A 100%)');
    expect(css).toContain(".sidebarGroup[data-active='true'] .sidebarGroupLabel");
    expect(css).toContain('inset 3px 0 0 var(--sa-v3-orange)');
    expect(css).toContain('.sidebarLinkActive::after');
    expect(css).toContain('.sidebarScroll::-webkit-scrollbar-thumb');
    expect(sidebar).toContain("'secure-loads': LockKeyhole");
    expect(sidebar).toContain("'platform-overview': LayoutDashboard");
    expect(sidebar).toContain("'compliance-overview': ShieldCheck");
  });

  it('keeps product navigation in the sidebar and owner controls in the owner menu', () => {
    expect(topbar).toContain("router.push(`/super-admin/search?q=${encodeURIComponent(query)}`)");
    expect(workspace).toContain("href: '/super-admin/action-centre'");
    expect(workspace).toContain("href: '/super-admin/notifications'");
    expect(topbar).not.toContain('href="/super-admin/action-centre"');
    expect(topbar).not.toContain('href="/super-admin/notifications"');
    expect(workspace).toContain("label: 'Platform Overview', href: '/super-admin/platform'");
    expect(topbar).toContain('href="/auth/sign-out"');
    expect(topbar).toContain('Authenticated platform-control session');
    expect(topbar).not.toContain('href="/super-admin" role="menuitem">Command Centre</Link>');
    expect(topbar).not.toContain('href="/super-admin/directory" role="menuitem">Explore all areas</Link>');
    expect(topbar).not.toContain('href="/super-admin/platform" role="menuitem">Platform Overview</Link>');
  });

  it('does not repeat sidebar page identity in a second shell context banner', () => {
    expect(shell).not.toContain('GROUP_DESCRIPTIONS');
    expect(shell).not.toContain('showContextBar');
    expect(shell).not.toContain('styles.contextBar');
    expect(shell).not.toContain('currentTarget?.label');
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
