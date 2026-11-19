'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { LayoutDashboard, PackagePlus, Truck, Tags, ClipboardCheck, CalendarDays, Menu, Network, MapPinned, FileText, Users, MessageSquare, Bell, BarChart3, Route, ShieldCheck, ChevronsLeft, ChevronsRight, ChevronDown, Settings } from 'lucide-react';
import {fleetHubGroupId,fleetHubContains} from './companyFleetNavigationModel';
import {usePathname} from 'next/navigation';
import type { WorkspaceNavGroup } from '../../../lib/workspaceRole';

const icons: Record<string, typeof LayoutDashboard> = {
  Dashboard:LayoutDashboard,'Post Load':PackagePlus,Loads:Truck,Quotes:Tags,Bookings:ClipboardCheck,
  'My Fleet':Truck,Drivers:Users,Diary:CalendarDays,Invoices:FileText,'Network & Tools':Network,
  Directory:Users,'Live Availability':MapPinned,'Return Journeys':Route,'Freight Vision':MapPinned,
  Messages:MessageSquare,Notifications:Bell,Reports:BarChart3,Settings,More:Menu,
};

export default function CompanyAdminSidebar({groups,ready,isActive,hrefFor,collapsed,onToggle}:{groups:WorkspaceNavGroup[];ready:boolean;isActive:(href:string)=>boolean;hrefFor:(href:string)=>string;collapsed:boolean;onToggle:()=>void}) {
  const [open,setOpen]=useState<string|null>(null);
  const pathname=usePathname();
  return <nav className="company-admin-sidebar" aria-label="Company Admin navigation" aria-busy={!ready}>
    <Link href={hrefFor('/admin')} className="company-admin-sidebar__brand" aria-label="Company dashboard" prefetch={false}>
      <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={196} height={64} priority/>
    </Link>
    <div className="company-admin-sidebar__items">
      {ready&&groups.map(group=>{
        const Icon=icons[group.label]??ShieldCheck;
        const isFleet=group.id===fleetHubGroupId;
        const active=isFleet?fleetHubContains(group,pathname??''):group.items.some(item=>isActive(item.href));
        if(group.items.length===1||isFleet){
          const item=group.items[0];
          return <Link key={group.id} href={hrefFor(item.href)} prefetch={false} className="company-admin-sidebar__item" data-active={active?'true':'false'} aria-current={active?'page':undefined} aria-label={group.label} title={group.label} onClick={()=>setOpen(null)}><Icon size={19} strokeWidth={2.3} aria-hidden="true"/><span>{group.label}</span></Link>
        }
        const expanded=open===group.id;
        return <div key={group.id} className="company-admin-sidebar__group">
          <button type="button" className="company-admin-sidebar__item" data-active={active?'true':'false'} aria-expanded={expanded} aria-controls={'company-sidebar-'+group.id} aria-label={group.label} title={group.label} onClick={()=>{if(collapsed){onToggle();setOpen(group.id)}else setOpen(expanded?null:group.id)}}><Icon size={19} strokeWidth={2.3} aria-hidden="true"/><span>{group.label}</span><ChevronDown size={15} className="company-admin-sidebar__caret" aria-hidden="true"/></button>
          {expanded&&!collapsed&&<div id={'company-sidebar-'+group.id} className="company-admin-sidebar__subitems" onKeyDown={event=>{if(event.key==='Escape'){setOpen(null);if(event.currentTarget.previousElementSibling instanceof HTMLElement)event.currentTarget.previousElementSibling.focus()}}}>{group.items.map(item=><Link key={item.href} href={hrefFor(item.href)} prefetch={false} aria-current={isActive(item.href)?'page':undefined} className="company-admin-sidebar__subitem" onClick={()=>setOpen(null)}>{item.label}</Link>)}</div>}
        </div>
      })}
    </div>
    <footer className="company-admin-sidebar__footer"><button type="button" onClick={()=>{setOpen(null);onToggle()}} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} title={collapsed?'Expand sidebar':'Collapse sidebar'} aria-expanded={!collapsed}>{collapsed?<ChevronsRight size={21}/>:<ChevronsLeft size={21}/>}</button></footer>
  </nav>
}