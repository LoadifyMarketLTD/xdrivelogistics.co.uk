'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { resolveWorkspaceRole, type WorkspaceRole } from '../../lib/workspaceRole';
import { useAuth } from '../components/AuthContext';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';

const FLEET_SURFACE_PARENT_ROLES = new Set<WorkspaceRole>([
  'company_owner',
  'company_admin',
  'carrier_admin',
  'fleet_manager',
]);

export function resolveAdminShellSurfaceRole(
  pathname: string,
  role: WorkspaceRole,
): WorkspaceRole | undefined {
  const cleanPath = pathname.split('?')[0]?.split('#')[0] || '/';
  const isFleetSurface = cleanPath === '/admin/fleet' || cleanPath.startsWith('/admin/fleet/');

  if (isFleetSurface && FLEET_SURFACE_PARENT_ROLES.has(role)) {
    return 'fleet_manager';
  }

  return undefined;
}

export default function AdminPlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/admin';
  const { user } = useAuth();
  const resolvedRole = resolveWorkspaceRole(user);
  const forcedRole = resolveAdminShellSurfaceRole(pathname, resolvedRole);

  return <TopWorkspaceShell forcedRole={forcedRole}>{children}</TopWorkspaceShell>;
}
