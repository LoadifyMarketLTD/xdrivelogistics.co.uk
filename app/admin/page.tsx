'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import RoleDashboard from '../components/workspace/RoleDashboards';

export default function CompanyWorkspaceHomePage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff', 'broker', 'driver']}>
      <RoleDashboard />
    </ProtectedRoute>
  );
}
