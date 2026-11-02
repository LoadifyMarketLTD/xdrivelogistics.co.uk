'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import { FleetControlDashboardHome } from '../../components/workspace/AdminRoleDashboardHome';

export default function FleetWorkspacePage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <FleetControlDashboardHome />
    </ProtectedRoute>
  );
}
