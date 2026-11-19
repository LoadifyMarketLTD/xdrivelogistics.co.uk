import type {WorkspaceNavGroup, WorkspaceNavItem} from '../../../lib/workspaceRole';

export const fleetHubHref='/admin/fleet/vehicles';
export const fleetHubPaths = [
 [fleetHubHref,'Overview'],
 ['/admin/vehicles','Vehicles'],
 ['/admin/drivers','Drivers & Staff'],
 ['/admin/fleet/resources','Assignments & Resources'],
 ['/admin/fleet/positions','Live Tracking'],
 ['/admin/documents','Compliance'],
 ['/admin/fleet/maintenance','Maintenance'],
 ['/admin/team','Team & Roles'],
 ['/admin/fleet/managers','Fleet Managers'],
 ['/admin/dispatchers','Dispatchers'],
 ['/admin/fleet/assignments','Job Allocation'],
 ['/admin/fleet','Fleet Dashboard'],
 ['/admin/fleet/future-availability','Future Positions'],
 ['/admin/fleet/availability','Availability'],
] as const;
export const fleetHubGroupId='company-sidebar-fleet-hub';
export function groupFleetNavigation(allowed:Map<string,WorkspaceNavItem>):WorkspaceNavGroup|null {
 if(!allowed.has(fleetHubHref))return null;
 const items=fleetHubPaths.flatMap(([href,label])=>{const i=allowed.get(href);return i?[{...i,label}]:[]});
 return {id:fleetHubGroupId,label:'My Fleet',items};
}
export function fleetSectionPath(pathname:string){
 if(pathname==='/admin/drivers-vehicles')return '/admin/fleet/resources';
 if(pathname==='/admin/fleet/drivers')return '/admin/drivers';
 return pathname;
}
export function fleetHubContains(group:WorkspaceNavGroup|undefined,pathname:string){
 return Boolean(group?.items.some(item=>item.href.split('?')[0]===fleetSectionPath(pathname)));
}
export function fleetHubLinks(group:WorkspaceNavGroup){
 const primary:string[]=[fleetHubHref,'/admin/vehicles','/admin/drivers','/admin/fleet/positions','/admin/documents','/admin/fleet/maintenance'];
 const tabs=group.items.filter(item=>primary.includes(item.href));
 const drivers=tabs.find(item=>item.href==='/admin/drivers');
 if(drivers)tabs.splice(tabs.indexOf(drivers)+1,0,{...drivers,id:'fleet-manage-drivers',label:'Manage Drivers',href:'/admin/drivers?manage=1'});
 return {tabs,tools:group.items.filter(item=>!primary.includes(item.href))};
}
export function fleetLinkActive(href:string,pathname:string,manage:string|null){
 const path=fleetSectionPath(pathname);
 if(href==='/admin/drivers?manage=1')return path==='/admin/drivers'&&manage==='1';
 if(href==='/admin/drivers')return path==='/admin/drivers'&&manage!=='1';
 return href===path;
}
