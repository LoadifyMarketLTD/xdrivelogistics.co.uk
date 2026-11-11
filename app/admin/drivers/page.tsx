'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberFleetOverview from '../../components/workspace/MemberFleetOverview';
export default function DriversWorkspacePage(){
 return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}><MemberFleetOverview section="drivers" canManage manageHref="/admin/drivers/manage" /></ProtectedRoute>;
}
