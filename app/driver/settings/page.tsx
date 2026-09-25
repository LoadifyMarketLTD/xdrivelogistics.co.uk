'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import RoleSettingsWorkspace from '../../components/workspace/RoleSettingsWorkspace';
import { useAuth } from '../../components/AuthContext';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';

export default function DriverSettingsPage() {
  const { user } = useAuth();
  const workspaceRole = resolveWorkspaceRole(user);
  const settingsRole = workspaceRole === 'owner_driver' ? 'owner' as const : 'driver' as const;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <RoleSettingsWorkspace role={settingsRole} />
    </ProtectedRoute>
  );
}
