'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import RoleSettingsWorkspace from '../../components/workspace/RoleSettingsWorkspace';

export default function OwnerDriverSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <RoleSettingsWorkspace role="owner" />
    </ProtectedRoute>
  );
}
