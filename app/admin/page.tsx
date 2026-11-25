'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoleDashboardHome from '../components/workspace/AdminRoleDashboardHome';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import Company3118Dashboard from '../company3118/Company3118Dashboard';

export default function CompanyWorkspaceHomePage() {
  const { user } = useAuth();
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      {resolveWorkspaceRole(user) === 'company_admin'
        ? <Company3118Dashboard />
        : <AdminRoleDashboardHome />}
    </ProtectedRoute>
  );
}
