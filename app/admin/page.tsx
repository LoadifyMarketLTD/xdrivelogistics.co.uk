'use client';
import ProtectedRoute from '../components/ProtectedRoute';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';
import {Company3150LiveProvider} from '../try-xdrive-demo/components/Company3150LiveData';
import CompanyMasterDashboard from '../components/workspace/CompanyMasterDashboard';
export default function CompanyWorkspaceHomePage(){
 return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}>
  <Company3150LiveProvider>
   <MasterWorkspace role="Company / Carrier" authenticated dashboard={<CompanyMasterDashboard role="Company / Carrier"/>}/>
  </Company3150LiveProvider>
 </ProtectedRoute>;
}
