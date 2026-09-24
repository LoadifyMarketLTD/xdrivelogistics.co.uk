'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import RoleSettingsWorkspace from '../../components/workspace/RoleSettingsWorkspace';
import { useAuth } from '../../components/AuthContext';

export default function DriverSettingsPage() {
  const { user } = useAuth();
  const settingsRole = user?.ownerDriverWorkspace ? 'owner' as const : 'driver' as const;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <RoleSettingsWorkspace role={settingsRole} />
    </ProtectedRoute>
  );
}
