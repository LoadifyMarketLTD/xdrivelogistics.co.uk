import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_SHELL_BREAKPOINTS,
  WORKSPACE_SHELL_DIMENSIONS,
  WORKSPACE_SHELL_MEASUREMENT_TOLERANCE,
} from '../app/components/workspace/workspaceShellContract';

const shell = readFileSync(resolve(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');
const superAdminShell = readFileSync(
  resolve(process.cwd(), 'app/super-admin/_components/SuperAdminWorkspaceShell.tsx'),
  'utf8',
);

const roleRoutes = [
  { role: 'admin', route: '/admin', actionCentre: '/admin/action-centre', notifications: '/admin/notifications' },
  { role: 'broker', route: '/broker', actionCentre: '/broker/action-centre', notifications: '/broker/notifications' },
  { role: 'customer', route: '/customer', actionCentre: '/customer/action-centre', notifications: '/customer/notifications' },
  { role: 'driver', route: '/driver', actionCentre: '/driver/action-centre', notifications: '/driver/notifications' },
  { role: 'super-admin', route: '/super-admin', actionCentre: '/super-admin', notifications: '/super-admin/notifications' },
] as const;

const viewports = [
  { label: 'desktop', width: 1440, expectedCompact: false },
  { label: 'tablet', width: 768, expectedCompact: true },
  { label: 'mobile', width: 390, expectedCompact: true },
] as const;

describe('workspace visual verification matrix evidence', () => {
  it('keeps shared-shell constants aligned with the visual gate', () => {
    expect(WORKSPACE_SHELL_DIMENSIONS.desktopSidebar).toBe(230);
    expect(WORKSPACE_SHELL_DIMENSIONS.compactSidebar).toBe(56);
    expect(WORKSPACE_SHELL_DIMENSIONS.mobileDrawer).toBe(280);
    expect(WORKSPACE_SHELL_DIMENSIONS.headerHeight).toBe(50);
    expect(WORKSPACE_SHELL_MEASUREMENT_TOLERANCE.desktopSidebarMin).toBe(228);
    expect(WORKSPACE_SHELL_MEASUREMENT_TOLERANCE.desktopSidebarMax).toBe(232);
    expect(shell).toContain('WORKSPACE_SHELL_DIMENSIONS.desktopSidebar');
    expect(shell).toContain('WORKSPACE_SHELL_DIMENSIONS.compactSidebar');
    expect(shell).toContain('WORKSPACE_SHELL_DIMENSIONS.mobileDrawer');
    expect(shell).toContain('Action Centre');
    expect(shell).toContain('Notifications');
    expect(shell).toContain('WORKSPACE_SHELL_BREAKPOINTS.compactMaxWidth');
    expect(shell).toContain('WORKSPACE_SHELL_BREAKPOINTS.mobileMaxWidth');
  });

  it('keeps super-admin on its dedicated read-only shell boundary', () => {
    expect(superAdminShell).toContain('<SuperAdminCardNavigationShell');
    expect(superAdminShell).not.toContain('<WorkspaceShell');
    expect(superAdminShell).toContain('definition={SUPER_ADMIN_WORKSPACE_DEFINITION}');
    expect(superAdminShell).toContain("label: 'Command Centre'");
    expect(superAdminShell).not.toContain('Owner Console');
    expect(superAdminShell).toContain('/super-admin/compliance/documents');
    expect(superAdminShell).toContain('/super-admin/compliance/fraud-cases');
  });

  it.each(roleRoutes)('ensures role route pages exist for $role', ({ route, actionCentre, notifications }) => {
    expect(existsSync(resolve(process.cwd(), 'app', route.replace(/^\//, ''), 'page.tsx'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'app', actionCentre.replace(/^\//, ''), 'page.tsx'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'app', notifications.replace(/^\//, ''), 'page.tsx'))).toBe(true);
  });

  it.each(viewports)('documents expected sidebar compact behaviour at $label width', ({ width, expectedCompact }) => {
    const computedCompact = width <= WORKSPACE_SHELL_BREAKPOINTS.compactMaxWidth;
    expect(computedCompact).toBe(expectedCompact);
  });
});
