'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import RoleSettingsWorkspace from '../../components/workspace/RoleSettingsWorkspace';
import { useAuth } from '../../components/AuthContext';
import { WORKSPACE_DEFINITIONS, resolveWorkspaceRole } from '../../../lib/workspaceRole';

export default function SettingsPage() {
  const { user } = useAuth();
  const workspaceRole = resolveWorkspaceRole(user);
  const settingsRole = workspaceRole === 'owner_driver'
    ? 'owner' as const
    : workspaceRole === 'driver'
      ? 'driver' as const
      : workspaceRole === 'broker'
        ? 'broker' as const
        : workspaceRole === 'customer'
          ? 'customer' as const
          : 'fleet' as const;
  const roleLabel = WORKSPACE_DEFINITIONS[workspaceRole].label;

  return (
    <ProtectedRoute>
      <RoleSettingsWorkspace role={settingsRole} roleLabel={roleLabel} />
    </ProtectedRoute>
  );
}
