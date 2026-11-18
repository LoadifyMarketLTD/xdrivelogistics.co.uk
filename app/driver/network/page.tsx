'use client';

import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';

const tools=[
 {href:'/driver/loads',title:'Freight Marketplace',description:'Find and quote on current authorised loads.'},
 {href:'/driver/directory',title:'Directory',description:'Search genuine members and your saved network.'},
 {href:'/driver/availability',title:'Live Availability',description:'Manage the visibility of your real availability.'},
 {href:'/driver/returns',title:'Return Journeys',description:'Browse and maintain opportunities for return trips.'},
 {href:'/driver/messages',title:'Messages',description:'Read and respond to your authenticated conversations.'},
 {href:'/driver/reports',title:'Reports',description:'View company-scoped operational performance and available finance totals.'},
] as const;

export default function DriverNetworkToolsPage(){
 return <ProtectedRoute allowedRoles={['driver']}>
  <DriverWorkspaceShell hideHeader>
   <section className="driver-network-tools" aria-label="Network and operational tools">
    <h1>Network &amp; Tools</h1>
    <p>Authenticated entry points for your freight network and driver operations.</p>
    <div className="driver-network-tools-grid">
     {tools.map(tool=><article key={tool.href} className="driver-network-tools-card">
      <h2>{tool.title}</h2><p>{tool.description}</p><Link href={tool.href}>Open {tool.title}</Link>
     </article>)}
    </div>
   </section>
  </DriverWorkspaceShell>
 </ProtectedRoute>;
}
