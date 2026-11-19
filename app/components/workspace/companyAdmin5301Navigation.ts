import type {WorkspaceNavGroup,WorkspaceNavItem} from '../../../lib/workspaceRole';
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
export function company5301IconRoute(href:string){return ownerRoutes[href.split('?')[0]]??href;}
export function organisationForCompany5301(groups:readonly WorkspaceNavGroup[]):WorkspaceNavGroup[]{
 const items=new Map<string,WorkspaceNavItem>();
 for(const g of groups)for(const i of g.items){if(g.id===fleetHubGroupId&&i.href!==fleetHubHref)continue;if(!items.has(i.href))items.set(i.href,g.id===fleetHubGroupId?{...i,label:'My Fleet'}:i);}
 const result:WorkspaceNavGroup[]=[];
 for(const [label,routes] of sections){const entries:WorkspaceNavItem[]=[];for(const href of routes){const item=items.get(href);if(item){entries.push(item);items.delete(href)}}if(entries.length)result.push({id:'company-5301-'+label,label,items:entries});}
 if(items.size)result.push({id:'company-5301-more',label:'More',items:[...items.values()]});return result;
}
export function activeCompany5301Href(groups:readonly WorkspaceNavGroup[],pathname:string,search:string):string|null{
 const fleet=groups.find(g=>g.id===fleetHubGroupId);if(fleetHubContains(fleet,pathname))return fleetHubHref;
 const params=new URLSearchParams(search);
 const matches=organisationForCompany5301(groups).flatMap(g=>g.items).filter(item=>{const [path,query]=item.href.split('?');if(path==='/admin'&&pathname!==path)return false;if(pathname!==path&&!pathname.startsWith(path+'/'))return false;return !query||(pathname===path&&[...new URLSearchParams(query)].every(([k,v])=>params.get(k)===v));});
 return matches.sort((a,b)=>b.href.split('?')[0].length-a.href.split('?')[0].length||Number(b.href.includes('?'))-Number(a.href.includes('?')))[0]?.href??null;
}
