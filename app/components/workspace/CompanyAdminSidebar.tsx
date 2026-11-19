'use client';
import Link from 'next/link';
import Image from 'next/image';
import {Suspense,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {LayoutDashboard,PackagePlus,Truck,Tags,ClipboardCheck,CalendarDays,Network,MapPinned,FileText,Users,MessageSquare,Bell,BarChart3,Route,ShieldCheck,ChevronsLeft,ChevronsRight,PackageSearch,Menu,Settings,UserRound,Clock,History,Headphones,Wallet,ClipboardList,MapPin,CircleAlert,FileCheck,LockKeyhole} from 'lucide-react';
import type {WorkspaceNavGroup} from '../../../lib/workspaceRole';
import {organisationForCompany5301,organisationForAdminRole5301,activeCompany5301Href,company5301IconRoute} from './companyAdmin5301Navigation';
import styles from './CompanyAdmin5301Sidebar.module.css';

const icons:Record<string,typeof LayoutDashboard>={'/driver':LayoutDashboard,'/driver/action-centre':CircleAlert,'/driver/post-load':PackagePlus,'/driver/posted-loads':ClipboardList,'/driver/loads':PackageSearch,'/driver/quotes':Tags,'/driver/won-work':ClipboardCheck,'/driver/jobs':ClipboardCheck,'/driver/history':CalendarDays,'/driver/availability/live':MapPinned,'/driver/availability':Clock,'/driver/returns':Route,'/driver/freight-vision':MapPin,'/driver/load-alerts':Bell,'/driver/nearby':MapPinned,'/driver/fleet':Truck,'/driver/vehicles':Truck,'/driver/drivers-vehicles':Users,'/driver/drivers':Users,'/driver/profile':UserRound,'/driver/documents':FileText,'/driver/vehicle-readiness':FileCheck,'/driver/finance':Wallet,'/driver/network':Network,'/driver/directory':Users,'/driver/reports':BarChart3,'/driver/messages':MessageSquare,'/driver/notifications':Bell,'/driver/event-log':History,'/driver/settings':Settings,'/driver/settings/billing':Wallet,'/driver/change-password':LockKeyhole,'/driver/support':Headphones};
function CompanyAdminSidebarContent({groups,pathname,search,ready,onPrefetch,homeHref,workspaceLabel='Company Admin'}:{groups:WorkspaceNavGroup[];pathname:string;search:string;ready:boolean;onPrefetch:(href:string)=>void;homeHref?:string;workspaceLabel?:string}){
 const [collapsed,setCollapsed]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 const active=activeCompany5301Href(groups,pathname,search,homeHref);
 const sections=homeHref?organisationForAdminRole5301(groups,homeHref):organisationForCompany5301(groups);
 return <aside className={styles.sidebar} data-collapsed={collapsed} data-mobile-open={mobileOpen} aria-label={workspaceLabel+" workspace sidebar"}>
  <div className={styles.controls}>
   <span className={styles.brand}><Image src="/xdrive-logo-company-3150.png" alt="XDrive Logistics" width={1440} height={390} unoptimized priority className={styles.brandImage}/></span>
   <button className={styles.desktopToggle} type="button" aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="company-admin-sidebar-links" onClick={()=>setCollapsed(v=>!v)}>{collapsed?<ChevronsRight size={20}/>:<ChevronsLeft size={20}/>}</button>
   <button className={styles.mobileToggle} type="button" aria-label="Toggle workspace navigation" aria-expanded={mobileOpen} aria-controls="company-admin-sidebar-links" onClick={()=>setMobileOpen(v=>!v)}><Menu size={20}/> Menu</button>
  </div>
  <nav id="company-admin-sidebar-links" className={styles.links} aria-label={workspaceLabel+" navigation"} aria-busy={!ready}>
   {sections.map(group=><section key={group.id} aria-label={group.label}><h2>{group.label}</h2>{group.items.map(item=>{const Icon=homeHref===item.href?LayoutDashboard:(icons[company5301IconRoute(item.href)]??ShieldCheck);return <Link key={item.href} href={item.href} prefetch={false} title={item.label} aria-label={item.label} aria-current={active===item.href?'page':undefined} onPointerEnter={()=>onPrefetch(item.href)} onFocus={()=>onPrefetch(item.href)} onClick={()=>setMobileOpen(false)}><Icon size={19} strokeWidth={2} aria-hidden="true"/><span>{item.label}</span></Link>})}</section>)}
  </nav>
 </aside>
}

type SidebarProps=Omit<Parameters<typeof CompanyAdminSidebarContent>[0],'search'>;
function SidebarWithSearch(props:SidebarProps){const params=useSearchParams();return <CompanyAdminSidebarContent {...props} search={params.toString()}/>;}
export default function CompanyAdminSidebar(props:SidebarProps){return <Suspense fallback={<CompanyAdminSidebarContent {...props} search=""/>}><SidebarWithSearch {...props}/></Suspense>;}