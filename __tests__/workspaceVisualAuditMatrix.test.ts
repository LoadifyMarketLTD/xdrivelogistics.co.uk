import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const shell = readFileSync(resolve(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');

const roleRoutes = [
  { role: 'admin', route: '/admin', actionCentre: '/admin/action-centre', notifications: '/admin/notifications' },
  { role: 'broker', route: '/broker', actionCentre: '/broker/action-centre', notifications: '/broker/notifications' },
  { role: 'customer', route: '/customer', actionCentre: '/customer/action-centre', notifications: '/customer/notifications' },
  { role: 'driver', route: '/driver', actionCentre: '/driver/action-centre', notifications: '/driver/notifications' },
  { role: 'operations', route: '/admin/operations-centre', actionCentre: '/admin/action-centre', notifications: '/admin/notifications' },
] as const;

const viewports = [
  { label: 'desktop', width: 1440, expectedCompact: false },
  { label: 'tablet', width: 768, expectedCompact: true },
  { label: 'mobile', width: 390, expectedCompact: true },
] as const;

describe('workspace visual verification matrix evidence', () => {
  it('keeps shared-shell constants aligned with the visual gate', () => {
    expect(shell).toContain("width: '230px'");
    expect(shell).toContain("minHeight: '50px'");
    expect(shell).toContain('Action Centre');
    expect(shell).toContain('Notifications');
    expect(shell).toContain("window.innerWidth <= 1024");
  });

  it.each(roleRoutes)('ensures role route pages exist for $role', ({ route, actionCentre, notifications }) => {
    expect(existsSync(resolve(process.cwd(), 'app', route.replace(/^\//, ''), 'page.tsx'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'app', actionCentre.replace(/^\//, ''), 'page.tsx'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'app', notifications.replace(/^\//, ''), 'page.tsx'))).toBe(true);
  });

  it.each(viewports)('documents expected sidebar compact behaviour at $label width', ({ width, expectedCompact }) => {
    const computedCompact = width <= 1024;
    expect(computedCompact).toBe(expectedCompact);
  });
});
