'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {useAuth} from '../AuthContext';
import {resolveWorkspaceRole} from '../../../lib/workspaceRole';
import './approved-demo-workspace-frame.css';

type Entry=[string,string];
const company:Entry[]=[['Dashboard','/admin'],['Post Load','/admin/post-load'],['Loads','/admin/marketplace'],['Quotes','/admin/exchange'],['Bookings','/admin/won-work'],['My Fleet','/admin/fleet/vehicles'],['Drivers','/admin/drivers'],['Diary','/admin/diary'],['Invoices','/admin/invoices'],['Network & Tools','/admin/operations-centre'],['Directory','/admin/marketplace/directory'],['Live Availability','/admin/live-availability'],['Return Journeys','/admin/fleet/returns'],['Freight Vision','/admin/freight-vision'],['Messages','/admin/messages'],['Notifications','/admin/notifications'],['Reports','/admin/finance/reports']];
const broker:Entry[]=[['Dashboard','/broker'],['Post Load','/broker/post-load'],['Loads','/broker/loads'],['Carrier Quotes','/broker/bids'],['Bookings','/broker/awards'],['Directory','/broker/carrier-network'],['Diary','/broker/diary'],['POD Review','/broker/pod-review'],['Finance','/broker/finance'],['Messages','/broker/messages'],['Notifications','/broker/notifications'],['Reports','/broker/reports']];
const customer:Entry[]=[['Dashboard','/customer'],['Post Load','/customer/post-load'],['Loads','/customer/loads'],['Quotes','/customer/quotes'],['Bookings','/customer/bookings'],['Diary','/customer/diary'],['Invoices','/customer/invoices'],['Network & Tools','/customer/network'],['Messages','/customer/messages'],['Notifications','/customer/notifications']];
const fleet:Entry[]=[['Dashboard','/admin/fleet'],['Directory','/admin/marketplace/directory'],['Live Availability','/admin/live-availability'],['My Fleet','/admin/fleet/vehicles'],['Return Journeys','/admin/fleet/returns'],['Jobs','/admin/fleet/jobs'],['Diary','/admin/diary'],['Freight Vision','/admin/freight-vision'],['Drivers & Vehicles','/admin/fleet/resources'],['Messages','/admin/messages']];
const dispatcher:Entry[]=[['Dashboard','/admin'],['Dispatch Board','/admin/marketplace'],['Allocations','/admin/won-work'],['Live Jobs','/admin/jobs'],['Diary','/admin/diary'],['Messages','/admin/messages'],['Reports','/admin/finance/reports'],['Network & Tools','/admin/operations-centre']];
const driver:Entry[]=[['Dashboard','/driver'],['Directory','/driver/directory'],['Return Journeys','/driver/returns'],['Loads','/driver/loads'],['Quotes','/driver/quotes'],['Bookings','/driver/won-work'],['Diary','/driver/history'],['Event Log','/driver/event-log'],['Messages','/driver/messages']];
const ownerDriver:Entry[]=[...driver,['Post Load','/driver/post-load'],['Invoices','/driver/finance']];
function isSelected(path:string,href:string){return path===href || (href!=='/admin'&&href!=='/broker'&&href!=='/customer'&&href!=='/driver'&&path.startsWith(href+'/'));}
export default function ApprovedDemoWorkspaceFrame({children,surface}:{children:ReactNode;surface:'admin'|'broker'|'customer'|'driver'}){
 const pathname=usePathname()||'';
 const {user,logout}=useAuth();
 const role=resolveWorkspaceRole(user);
 const entries=surface==='customer'?customer:surface==='broker'?broker:surface==='driver'?(role==='owner_driver'?ownerDriver:driver):role==='fleet_manager'?fleet:role==='dispatcher'?dispatcher:company;
 return <div className="xdrive-approved-demo-frame">
   <aside className="xdrive-approved-demo-sidebar" aria-label="XDrive workspace navigation">
    <Link className="xdrive-approved-demo-brand" href={entries[0][1]}>XDRIVE <em>LOGISTICS</em></Link>
    <nav>{entries.map(([title,href])=><Link key={title} href={href} aria-current={isSelected(pathname,href)?'page':undefined} className={isSelected(pathname,href)?'active':undefined}>{title}</Link>)}</nav>
   </aside>
   <div className="xdrive-approved-demo-main"><header className="xdrive-approved-demo-header"><span>XDRIVE <em>LOGISTICS</em></span><div className="xdrive-approved-demo-actions"><Link href={surface==='admin'?'/admin/post-load':surface==='driver'?'/driver/post-load':surface==='customer'?'/customer/post-load':'/broker/post-load'}>Post Load</Link><Link href={surface==='admin'?'/admin/notifications':surface==='driver'?'/driver/notifications':surface==='customer'?'/customer/notifications':'/broker/notifications'}>Notifications</Link><button type="button" onClick={()=>void logout()}>Sign out</button></div></header>
   <nav className="xdrive-approved-demo-mobile" aria-label="Mobile workspace navigation">{entries.map(([title,href])=><Link key={title} href={href} aria-current={isSelected(pathname,href)?'page':undefined}>{title}</Link>)}</nav>
   <div className="xdrive-approved-demo-content">{children}</div></div>
 </div>;
}
