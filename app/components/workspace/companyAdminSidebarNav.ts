import type { WorkspaceNavGroup, WorkspaceNavItem } from '../../../lib/workspaceRole';
import {groupFleetNavigation} from './companyFleetNavigationModel';

export const companySidebarOrder = [
  ['Dashboard','/admin'], ['Post Load','/admin/post-load'], ['Loads','/admin/marketplace'],
  ['Quotes','/admin/exchange'], ['Bookings','/admin/jobs'], ['My Fleet','/admin/fleet/vehicles'],
  ['Drivers','/admin/drivers'], ['Diary','/admin/diary'], ['Invoices','/admin/invoices'],
  ['Network & Tools','/admin/network-tools'], ['Directory','/admin/marketplace/directory'], ['Live Availability','/admin/live-availability'],
  ['Return Journeys','/admin/fleet/returns'], ['Freight Vision','/admin/freight-vision'],
  ['Messages','/admin/messages'], ['Notifications','/admin/notifications'], ['Reports','/admin/finance/reports'],
  ['Settings','/admin/settings'],
] as const;

/** Only consumes the server-authority-aligned, permission-filtered navigation supplied by the shell. */
export function composeCompanyAdminSidebarNav(groups: WorkspaceNavGroup[]): WorkspaceNavGroup[] {
  const allowed = new Map<string, WorkspaceNavItem>();
  for (const group of groups) for (const item of group.items) if (!allowed.has(item.href)) allowed.set(item.href,item);
  const direct: WorkspaceNavGroup[] = [];
  const used = new Set<string>();
  const fleet=groupFleetNavigation(allowed);
  if(fleet)for(const item of fleet.items)used.add(item.href);
  for (const [label,href] of companySidebarOrder) {
    if(fleet&&href==='/admin/fleet/vehicles'){direct.push(fleet);continue;}
    if(used.has(href))continue;
    const item = allowed.get(href);
    if (!item) continue;
    used.add(href);
    direct.push({id:'company-sidebar-'+item.id,label,items:[{...item,label}]});
  }
  const tools = ['/admin/bulk-import','/admin/documents','/admin/event-log'].flatMap(href=>{
    const item=allowed.get(href); if (!item || used.has(href)) return [];
    if (!used.has('/admin/network-tools')) used.add(href);return [item];
  });
  if (tools.length && !used.has('/admin/network-tools')) {
    const directoryIndex=direct.findIndex(g=>g.label==='Directory');
    direct.splice(directoryIndex<0?direct.length:directoryIndex,0,{id:'company-sidebar-tools',label:'Network & Tools',items:tools});
  }
  const remainder=[...allowed.values()].filter(item=>!used.has(item.href));
  if (remainder.length) direct.push({id:'company-sidebar-more',label:'More',items:remainder});
  return direct;
}