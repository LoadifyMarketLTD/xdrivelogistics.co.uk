'use client';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {ChevronDown} from 'lucide-react';
import type {WorkspaceNavGroup} from '../../../lib/workspaceRole';
import {fleetHubContains,fleetHubLinks,fleetLinkActive} from './companyFleetNavigationModel';

const staffPaths=['/admin/team','/admin/fleet/managers','/admin/dispatchers'];
export default function CompanyFleetNavigation({group}:{group:WorkspaceNavGroup|undefined}){
 const pathname=usePathname()??'';
 const params=useSearchParams();
 if(!group||!fleetHubContains(group,pathname))return null;
 const {tabs,tools}=fleetHubLinks(group);
 const active=(href:string)=>fleetLinkActive(href,pathname,params.get('manage'));
 const staffContext=pathname==='/admin/drivers'||pathname==='/admin/fleet/drivers'||staffPaths.includes(pathname);
 const personnel=staffContext?tools.filter(item=>staffPaths.includes(item.href)):[];
 const otherTools=tools.filter(item=>!personnel.some(p=>p.href===item.href));
 return <nav className="company-fleet-hub" aria-label="My Fleet sections">
   <div className="company-fleet-hub__links">
     {tabs.map(item=><Link key={item.href} href={item.href} prefetch={false} aria-current={active(item.href)?'page':undefined} data-section-active={item.href==='/admin/drivers'&&staffPaths.includes(pathname)?'true':undefined}>{item.label}</Link>)}
     {otherTools.length>0&&<details className="company-fleet-hub__tools" key={pathname}><summary data-active={otherTools.some(item=>active(item.href))}>{otherTools.find(item=>active(item.href))?.label??'Fleet tools'} <ChevronDown size={15} aria-hidden="true"/></summary><div>{otherTools.map(item=><Link key={item.href} href={item.href} prefetch={false} aria-current={active(item.href)?'page':undefined}>{item.label}</Link>)}</div></details>}
   </div>
   {personnel.length>0&&<div className="company-fleet-hub__personnel" role="group" aria-label="Staff administration"><span>Staff administration</span>{personnel.map(item=><Link key={item.href} href={item.href} prefetch={false} aria-current={active(item.href)?'page':undefined}>{item.label}</Link>)}</div>}
 </nav>
}
