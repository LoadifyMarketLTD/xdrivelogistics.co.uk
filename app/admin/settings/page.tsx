'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import RoleSettingsWorkspace from '../../components/workspace/RoleSettingsWorkspace';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <RoleSettingsWorkspace role="fleet" />
    </ProtectedRoute>
  );
}
