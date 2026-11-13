'use client';
import {useState} from 'react';
import {Company3150LiveProvider} from '../try-xdrive-demo/components/Company3150LiveData';
import CompanyMasterDashboard from '../components/workspace/CompanyMasterDashboard';
import CustomerDashboardHome from './CustomerDashboardHome';

/** Approved 3150 Dashboard, hosted by the persistent authenticated Customer shell. */
export default function CustomerWorkspaceHome(){
 const [showControls,setShowControls]=useState(false);
 return <Company3150LiveProvider>
   <CompanyMasterDashboard role="Customer"/>
   <section className="master3150-customer-controls">
    <button type="button" aria-expanded={showControls} onClick={()=>setShowControls(open=>!open)}>
     {showControls?'Hide':'Show'} Customer Commercial & Operational Controls
    </button>
    {showControls&&<CustomerDashboardHome/>}
   </section>
 </Company3150LiveProvider>;
}
