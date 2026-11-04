'use client';
import type {ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import ApprovedSidebar from '../../try-xdrive-demo/components/ApprovedSidebar';
import MasterLogoutButton from '../../try-xdrive-demo/components/MasterLogoutButton';
import {MASTER_WORKSPACE_TABS,type MasterWorkspaceRole} from '../../try-xdrive-demo/components/MasterWorkspacePolicy';
import {masterNavigationHref} from '../../../lib/masterWorkspaceNavigation';
import '../../try-xdrive-demo/xdrive-design-system.css';
import '../../try-xdrive-demo/demo.css';
import '../../try-xdrive-demo/wide-layout.css';
import '../../try-xdrive-demo/components/operations-demo.css';
import '../../try-xdrive-demo/components/company-sidebar-compact.css';
import '../../try-xdrive-demo/components/company-layout-stability.css';

/**
 * Production-only Master visual shell. Intentionally does NOT import
 * demonstration data stores, local browser records or simulated operations.
 * All child content is the existing authenticated server/API-backed route.
 */
export default function AuthenticatedMasterShell({role,activeTab,children}:{
 role:MasterWorkspaceRole;activeTab:number;children:ReactNode;
}){
 const router=useRouter();
 const tabs=[...MASTER_WORKSPACE_TABS];
 const disabledIndices=tabs.map((_,i)=>masterNavigationHref(role,i)?-1:i).filter(i=>i>=0);
 const navigate=(index:number)=>{
  const target=masterNavigationHref(role,index);
  if(target)router.push(target);
 };
 return <main className="demo-shell ops-demo xd-approved-sidebar-shell" data-master-workspace="production">
  <ApprovedSidebar items={tabs} activeIndex={activeTab} onSelect={navigate} disabledIndices={disabledIndices} footerAction={<MasterLogoutButton/>}/>
  <div className="content"><header className="topbar">
   <div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div>
   <div className="top-actions"><MasterLogoutButton/></div>
  </header><div className="page">{children}</div></div>
 </main>;
}
