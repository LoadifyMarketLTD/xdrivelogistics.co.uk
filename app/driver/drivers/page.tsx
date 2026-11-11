'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberFleetOverview from '../../components/workspace/MemberFleetOverview';
export default function DriverCompanyDriversPage(){
 return <ProtectedRoute allowedRoles={['driver']}><MemberFleetOverview section="drivers" /></ProtectedRoute>;
}
