'use client';

import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import {PageFrame,PageHeader,Panel} from '../../components/workspace/WorkspaceUI';

/** Authenticated entry points only: no preview or fabricated network records. */
export default function CompanyNetworkToolsPage(){
 return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}>
  <PageFrame>
   <PageHeader eyebrow="Company operations" title="Network & Tools" description="Access the company's real network and operational tools."/>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
    <Panel title="Carrier Marketplace"><p>Review the authenticated transport exchange.</p><Link href="/admin/marketplace">Open Marketplace</Link></Panel>
    <Panel title="Directory"><p>Access the company directory.</p><Link href="/admin/marketplace/directory">Open Directory</Link></Panel>
    <Panel title="Team & Roles"><p>Review company roles and permitted administration.</p><Link href="/admin/team">Open Team & Roles</Link></Panel>
    <Panel title="Company Settings"><p>Manage settings available to your role.</p><Link href="/admin/settings">Open Settings</Link></Panel>
   </div>
  </PageFrame>
 </ProtectedRoute>;
}
