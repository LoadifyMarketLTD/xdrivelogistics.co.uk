'use client';
import {useState} from 'react';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';
import {Company3150LiveProvider} from '../try-xdrive-demo/components/Company3150LiveData';
import CompanyMasterDashboard from '../components/workspace/CompanyMasterDashboard';
import CustomerDashboardHome from './CustomerDashboardHome';

/**
 * Approved 3150 Dashboard is the default for Customer.
 * The authenticated Customer commercial controls are retained until each
 * control is migrated without loss of award, tracking, POD or invoicing.
 */
export default function CustomerWorkspaceHome(){
 const [showControls,setShowControls]=useState(false);
 return <Company3150LiveProvider>
  <MasterWorkspace role="Customer" authenticated dashboard={<>
   <CompanyMasterDashboard role="Customer"/>
   <section className="master3150-customer-controls">
    <button type="button" aria-expanded={showControls} onClick={()=>setShowControls(open=>!open)}>
     {showControls?'Hide':'Show'} Customer Commercial & Operational Controls
    </button>
    {showControls&&<CustomerDashboardHome/>}
   </section>
  </>}/>
 </Company3150LiveProvider>;
}
