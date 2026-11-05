'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberFleetOverview from '../../components/workspace/MemberFleetOverview';

export default function FleetWorkspacePage() {
  return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}>
    <MemberFleetOverview section="fleet" canManage manageHref="/admin/fleet/vehicles" />
  </ProtectedRoute>;
}
