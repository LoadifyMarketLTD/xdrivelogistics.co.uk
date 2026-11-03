'use client';
import ProtectedRoute from '../components/ProtectedRoute';
import OperationsDemo from '../try-xdrive-demo/components/OperationsDemo';
export default function CompanyWorkspaceHomePage(){
 return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}><OperationsDemo role="Carrier / Company"/></ProtectedRoute>;
}
