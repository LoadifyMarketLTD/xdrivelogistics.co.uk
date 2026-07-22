'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { resolveAdminDashboardKind } from '../../lib/adminWorkspaceRole';
import AdminWorkspaceView from './AdminWorkspaceView';
import {
  CarrierDashboard,
  ComplianceDashboard,
  FinanceDashboard,
  FleetDashboard,
} from '../components/workspace/RoleDashboards';

function CompanyWorkspaceRoleDashboard() {
  const { user } = useAuth();
  const role = resolveWorkspaceRole(user);
  const dashboard = resolveAdminDashboardKind(role, Boolean(user?.companyId));

  if (dashboard === 'fleet') return <FleetDashboard />;
  if (dashboard === 'finance') return <FinanceDashboard />;
  if (dashboard === 'compliance') return <ComplianceDashboard />;
  if (dashboard === 'admin') return <AdminWorkspaceView />;
  return <CarrierDashboard />;
}

export default function CompanyWorkspaceHomePage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <CompanyWorkspaceRoleDashboard />
    </ProtectedRoute>
  );
}
