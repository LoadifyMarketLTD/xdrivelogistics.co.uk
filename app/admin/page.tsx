'use client';
import ProtectedRoute from '../components/ProtectedRoute';
import OperationsDemo from '../try-xdrive-demo/components/OperationsDemo';
import { Company3150LiveProvider } from '../try-xdrive-demo/components/Company3150LiveData';
export default function CompanyWorkspaceHomePage(){
 return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}><Company3150LiveProvider><OperationsDemo role="Carrier / Company"/></Company3150LiveProvider></ProtectedRoute>;
}
