'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import { FleetDashboard } from '../../components/workspace/RoleDashboards';

export default function FleetWorkspacePage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <FleetDashboard />
    </ProtectedRoute>
  );
}
