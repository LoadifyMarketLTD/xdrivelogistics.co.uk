'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Menu} from 'lucide-react';
import {usePathname,useRouter} from 'next/navigation';
import ApprovedSidebar from '../../try-xdrive-demo/components/ApprovedSidebar';
import MasterLogoutButton from '../../try-xdrive-demo/components/MasterLogoutButton';
import {MASTER_WORKSPACE_TABS,type MasterWorkspaceRole} from '../../try-xdrive-demo/components/MasterWorkspacePolicy';
import {masterNavigationHref} from '../../../lib/masterWorkspaceNavigation';
import {useAuth} from '../AuthContext';
import '../../try-xdrive-demo/xdrive-design-system.css';
import '../../try-xdrive-demo/demo.css';
import '../../try-xdrive-demo/wide-layout.css';
import '../../try-xdrive-demo/components/operations-demo.css';
import '../../try-xdrive-demo/components/company-sidebar-compact.css';
import '../../try-xdrive-demo/components/company-layout-stability.css';
import './master3150-production.css';
import './master3150-design-system.css';
import './master3150-operations-shell.css';
import './master3150-board-reference.css';
import '../../try-xdrive-demo/components/mobile-master-navigation.css';
import './authenticated-master-mobile-content.css';

/**
 * Production-only Master visual shell. Intentionally does NOT import
 * demonstration data stores, local browser records or simulated operations.
 * All child content is the existing authenticated server/API-backed route.
 */
export default function AuthenticatedMasterShell({role,activeTab,children}:{
 role:MasterWorkspaceRole;activeTab:number;children:ReactNode;
}){
 const router=useRouter();
 const pathname=usePathname();
 const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
 const [pendingTab,setPendingTab]=useState<number|null>(null);
 const pendingTarget=useRef<string|null>(null);
 useEffect(()=>setMobileMenuOpen(false),[activeTab]);
 useEffect(()=>{pendingTarget.current=null;setPendingTab(null);},[pathname]);
 useEffect(()=>{if(!mobileMenuOpen)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileMenuOpen(false);};const original=document.body.style.overflow;document.body.style.overflow='hidden';window.addEventListener('keydown',close);return()=>{window.removeEventListener('keydown',close);document.body.style.overflow=original;};},[mobileMenuOpen]);
 const {user}=useAuth();
 const driverQuoteBlocked=['Driver','Company Driver','Owner Driver'].includes(role)&&user?.canCommercialBid!==true;
 const tabs=[...MASTER_WORKSPACE_TABS];
 const disabledIndices=tabs.map((_,i)=>!masterNavigationHref(role,i)||(i===3&&driverQuoteBlocked)?i:-1).filter(i=>i>=0);
 const navigate=(index:number)=>{
  const target=masterNavigationHref(role,index);
  if(!target||disabledIndices.includes(index))return;


  if(index===2&&pathname===target){window.dispatchEvent(new Event('xdrive:loads-reselect'));window.scrollTo({top:0,behavior:'instant'});setMobileMenuOpen(false);return;}
  if(pathname===target){setPendingTab(null);pendingTarget.current=null;return;}
  pendingTarget.current=target;
  setPendingTab(index);
  router.push(target);
 };
 return <main className="demo-shell ops-demo xd-approved-sidebar-shell master3150-production" data-master-workspace="production">
  <button type="button" className={'xd-mobile-sidebar-backdrop'+(mobileMenuOpen?' is-open':'')} aria-label="Close workspace navigation" tabIndex={mobileMenuOpen?0:-1} onClick={()=>setMobileMenuOpen(false)}/>
  <ApprovedSidebar items={tabs} activeIndex={pendingTab??activeTab} onSelect={navigate} disabledIndices={disabledIndices} mobileOpen={mobileMenuOpen} onMobileClose={()=>setMobileMenuOpen(false)} footerAction={<MasterLogoutButton/>}/>
  <div className="content" aria-busy={pendingTab!==null}><header className="topbar">
   <button type="button" className="xd-mobile-nav-toggle" aria-label="Open workspace menu" aria-controls="xdrive-master-mobile-navigation" aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen(true)}><Menu size={21} aria-hidden="true"/> Menu</button>
   <div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div>
   <div className="top-actions"><MasterLogoutButton/></div>
  </header>{pendingTab!==null&&<div className="master-navigation-loading" role="status" aria-live="polite">Opening {tabs[pendingTab]}...</div>}<div className="page">{children}</div></div>
 </main>;
}
