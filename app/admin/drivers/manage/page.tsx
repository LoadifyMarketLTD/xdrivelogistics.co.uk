'use client';
import ProtectedRoute from '../../../components/ProtectedRoute';
import LegacyDriversManagement from '../LegacyDriversManagement';
export default function DriverManagementPage(){
 return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}><LegacyDriversManagement /></ProtectedRoute>;
}
