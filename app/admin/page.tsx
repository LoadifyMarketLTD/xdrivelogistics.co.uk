'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
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

  if (role === 'fleet_manager') return <FleetDashboard />;
  if (role === 'finance') return <FinanceDashboard />;
  if (role === 'compliance') return <ComplianceDashboard />;
  if (['platform_owner', 'company_owner', 'company_admin', 'carrier_admin', 'dispatcher'].includes(role)) {
    if (role === 'platform_owner' && !user?.companyId) return <CarrierDashboard />;
    return <AdminWorkspaceView />;
  }

  return <CarrierDashboard />;
}

export default function CompanyWorkspaceHomePage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <CompanyWorkspaceRoleDashboard />
    </ProtectedRoute>
  );
}
