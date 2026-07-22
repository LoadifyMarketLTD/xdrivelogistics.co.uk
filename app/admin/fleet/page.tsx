'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import { FleetDashboardView } from './FleetWorkspaceViews';

export default function FleetWorkspacePage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <FleetDashboardView />
    </ProtectedRoute>
  );
}
