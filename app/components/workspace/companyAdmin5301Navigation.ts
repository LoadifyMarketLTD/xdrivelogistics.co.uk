import type {WorkspaceRole,WorkspaceNavGroup,WorkspaceNavItem} from '../../../lib/workspaceRole';
import {fleetHubGroupId,fleetHubContains,fleetHubHref} from './companyFleetNavigationModel';

const sections=[
 ['Overview',['/admin','/admin/action-centre']],
 ['Commercial',['/admin/post-load','/admin/posted-loads','/admin/marketplace','/admin/exchange','/admin/bids','/admin/quotes','/admin/won-work']],
 ['Operations',['/admin/jobs','/admin/diary','/admin/live-availability','/admin/fleet/returns','/admin/freight-vision','/admin/pod']],
 ['My resources',[fleetHubHref,'/admin/drivers','/admin/vehicles','/admin/fleet/resources','/admin/documents']],
 ['Business',['/admin/invoices','/admin/finance/carrier-invoices','/admin/finance/customer-invoices','/admin/finance/statements','/admin/network-tools','/admin/marketplace/directory','/admin/finance/reports']],
 ['Communication',['/admin/messages','/admin/notifications','/admin/event-log']],
 ['Account',['/admin/settings','/admin/settings/billing']],
] as const;
const ownerRoutes:Record<string,string>={'/admin':'/driver','/admin/action-centre':'/driver/action-centre','/admin/post-load':'/driver/post-load','/admin/posted-loads':'/driver/posted-loads','/admin/marketplace':'/driver/loads','/admin/exchange':'/driver/quotes','/admin/bids':'/driver/quotes','/admin/quotes':'/driver/quotes','/admin/won-work':'/driver/won-work','/admin/jobs':'/driver/jobs','/admin/diary':'/driver/history','/admin/live-availability':'/driver/availability/live','/admin/fleet/returns':'/driver/returns','/admin/freight-vision':'/driver/freight-vision','/admin/pod':'/driver/documents','/admin/fleet/vehicles':'/driver/fleet','/admin/drivers':'/driver/drivers','/admin/vehicles':'/driver/vehicles','/admin/fleet/resources':'/driver/drivers-vehicles','/admin/documents':'/driver/documents','/admin/invoices':'/driver/finance','/admin/finance/carrier-invoices':'/driver/finance','/admin/finance/customer-invoices':'/driver/finance','/admin/finance/statements':'/driver/finance','/admin/network-tools':'/driver/network','/admin/marketplace/directory':'/driver/directory','/admin/finance/reports':'/driver/reports','/admin/messages':'/driver/messages','/admin/notifications':'/driver/notifications','/admin/event-log':'/driver/event-log','/admin/settings':'/driver/settings','/admin/settings/billing':'/driver/settings/billing'};
const masterAdminRoles:ReadonlySet<WorkspaceRole>=new Set(['company_owner','company_admin','carrier_admin','fleet_manager','dispatcher','finance','compliance','viewer']);
export function usesMasterAdminSidebar(role:WorkspaceRole,enabled:boolean,fixture:boolean){return enabled&&!fixture&&masterAdminRoles.has(role);}
export function organisationForAdminRole5301(groups:readonly WorkspaceNavGroup[],homeHref:string):WorkspaceNavGroup[]{
 const used=new Set<string>();
 const clean=groups.map(group=>({...group,items:group.items.filter(item=>{if(used.has(item.href))return false;used.add(item.href);return true;})})).filter(group=>group.items.length>0);
 const home=clean.flatMap(group=>group.items).find(item=>item.href===homeHref);
 const order=['Overview','Commercial','Operations','My resources','Finance','Compliance','Business','Communication','Account','More'];
 const partition=new Map<string,WorkspaceNavItem[]>();
 const add=(label:string,item:WorkspaceNavItem)=>partition.set(label,[...(partition.get(label)??[]),item]);
 if(home)add('Overview',home);
 for(const item of clean.flatMap(group=>group.items)){
   if(item.href===homeHref)continue;
   const p=item.href.split('?')[0];
   let label='More';
   if(p==='/admin/action-centre')label='Overview';
   else if(/^\/admin\/(post-load|posted-loads|marketplace|exchange|bids|quotes|won-work|bulk-import)$/.test(p))label='Commercial';
   else if(/^\/admin\/(jobs|diary|collections|deliveries|live-availability|freight-vision|pod|incidents)(\/|$)/.test(p)||/^\/admin\/fleet\/(jobs|assignments|active-jobs|positions|returns|availability|future-availability)(\/|$)/.test(p))label='Operations';
   else if(/^\/admin\/(documents|compliance)(\/|$)/.test(p)||p==='/admin/fleet/compliance')label='Compliance';
   else if(/^\/admin\/(fleet|drivers|vehicles|drivers-vehicles|team|dispatchers)(\/|$)/.test(p))label='My resources';
   else if(/^\/admin\/(finance|invoices)(\/|$)/.test(p))label='Finance';
   else if(/^\/admin\/(network-tools|marketplace\/directory)(\/|$)/.test(p))label='Business';
   else if(/^\/admin\/(messages|notifications|event-log)(\/|$)/.test(p))label='Communication';
   else if(/^\/admin\/(settings|profile|support)(\/|$)/.test(p))label='Account';
   add(label,item);
 }
 return order.flatMap(label=>{const items=partition.get(label);return items?[{id:'master-role-'+label,label,items}]:[]});
}
export function company5301IconRoute(href:string){const route=href.split('?')[0];return ownerRoutes[route]??({ '/admin/fleet':'/driver/fleet','/admin/fleet/jobs':'/driver/jobs','/admin/fleet/assignments':'/driver/jobs','/admin/fleet/active-jobs':'/driver/jobs','/admin/fleet/drivers':'/driver/drivers','/admin/fleet/positions':'/driver/availability/live','/admin/fleet/availability':'/driver/availability','/admin/fleet/future-availability':'/driver/availability','/admin/fleet/compliance':'/driver/documents','/admin/fleet/maintenance':'/driver/vehicle-readiness','/admin/documents/expiry':'/driver/documents','/admin/documents/company':'/driver/documents','/admin/finance/balances':'/driver/finance','/admin/finance/payments':'/driver/finance','/admin/incidents':'/driver/action-centre'} as Record<string,string>)[route]??href;}
export function organisationForCompany5301(groups:readonly WorkspaceNavGroup[]):WorkspaceNavGroup[]{
 const items=new Map<string,WorkspaceNavItem>();
 for(const g of groups)for(const i of g.items){if(g.id===fleetHubGroupId&&i.href!==fleetHubHref)continue;if(!items.has(i.href))items.set(i.href,g.id===fleetHubGroupId?{...i,label:'My Fleet'}:i);}
 const result:WorkspaceNavGroup[]=[];
 for(const [label,routes] of sections){const entries:WorkspaceNavItem[]=[];for(const href of routes){const item=items.get(href);if(item){entries.push(item);items.delete(href)}}if(entries.length)result.push({id:'company-5301-'+label,label,items:entries});}
 if(items.size)result.push({id:'company-5301-more',label:'More',items:[...items.values()]});return result;
}
export function activeCompany5301Href(groups:readonly WorkspaceNavGroup[],pathname:string,search:string,homeHref?:string):string|null{
 const fleet=groups.find(g=>g.id===fleetHubGroupId);if(fleetHubContains(fleet,pathname))return fleetHubHref;
 const params=new URLSearchParams(search);
 const matches=(homeHref?organisationForAdminRole5301(groups,homeHref):organisationForCompany5301(groups)).flatMap(g=>g.items).filter(item=>{const [path,query]=item.href.split('?');if(path==='/admin'&&pathname!==path)return false;if(pathname!==path&&!pathname.startsWith(path+'/'))return false;return !query||(pathname===path&&[...new URLSearchParams(query)].every(([k,v])=>params.get(k)===v));});
 return matches.sort((a,b)=>b.href.split('?')[0].length-a.href.split('?')[0].length||Number(b.href.includes('?'))-Number(a.href.includes('?')))[0]?.href??null;
}
