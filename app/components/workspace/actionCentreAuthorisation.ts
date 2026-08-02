import { resolveWorkspaceSurfaceRole, type WorkspaceRole } from '../../../lib/workspaceRole';
import type { ActionCentreRole } from './actionCentreConfig';

export function isActionCentreRoleAllowed(
  requestedRole: ActionCentreRole,
  resolvedRole: WorkspaceRole,
): boolean {
  if (requestedRole === 'admin') {
    return !['broker', 'customer', 'driver', 'owner_driver', 'viewer'].includes(resolvedRole);
  }

  const requestedPath =
    requestedRole === 'broker'
      ? '/broker/action-centre'
      : requestedRole === 'customer'
        ? '/customer/action-centre'
        : '/driver/action-centre';

  const allowedSurface = resolveWorkspaceSurfaceRole(requestedPath, resolvedRole);
  return requestedRole === 'driver'
    ? allowedSurface === 'driver' || allowedSurface === 'owner_driver'
    : allowedSurface === requestedRole;
}
