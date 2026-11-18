'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberFleetOverview from '../../components/workspace/MemberFleetOverview';
import { useAuth } from '../../components/AuthContext';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
export default function DriverFleetPage(){
 const { user } = useAuth();
 const canManage = resolveWorkspaceRole(user) === 'owner_driver' || (user?.role === 'driver' && user?.membershipRole?.toLowerCase() === 'owner');
 return <ProtectedRoute allowedRoles={['driver']}>
  <MemberFleetOverview section="fleet" canManage={canManage} manageHref={canManage ? '/driver/vehicles' : undefined} />
 </ProtectedRoute>;
}
