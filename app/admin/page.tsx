'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoleDashboardHome from '../components/workspace/AdminRoleDashboardHome';

export default function CompanyWorkspaceHomePage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <AdminRoleDashboardHome />
    </ProtectedRoute>
  );
}
