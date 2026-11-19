import {describe,it,expect} from 'vitest';
import {getVisibleWorkspaceNav,getWorkspaceDefinition} from '../lib/workspaceRole';
import {organisationForAdminRole5301,usesMasterCommercialSidebar,activeCompany5301Href,company5301IconRoute} from '../app/components/workspace/companyAdmin5301Navigation';
describe('Master 5301 commercial portals',()=>{
 it.each(['broker','customer'] as const)('preserves all %s destinations without cross-portal links',role=>{
 const nav=getVisibleWorkspaceNav(role);const home=getWorkspaceDefinition(role).homeHref;
 const sections=organisationForAdminRole5301(nav,home);
 expect(usesMasterCommercialSidebar(role,true,false)).toBe(true);
 expect(usesMasterCommercialSidebar(role,true,true)).toBe(false);
 expect(sections[0].items[0].href).toBe(home);
 expect(sections.flatMap(g=>g.items.map(i=>i.href)).sort()).toEqual([...new Set(nav.flatMap(g=>g.items.map(i=>i.href)))].sort());
 expect(sections.flatMap(g=>g.items).every(i=>i.href.startsWith('/'+role))).toBe(true);
 expect(sections.find(g=>g.label==='Commercial')).toBeDefined();
 expect(activeCompany5301Href(nav,home+'/unknown','',home)).toBeNull();
 });
 it('does not activate the commercial sidebar for a protected or execution role',()=>{for(const role of ['platform_owner','company_admin','driver','owner_driver','viewer'] as const)expect(usesMasterCommercialSidebar(role,true,false)).toBe(false)});
 it('selects nested register and query variants without changing destination',()=>{const nav=[{id:'customer',label:'Customer',items:[{id:'home',label:'Dashboard',href:'/customer'},{id:'quotes',label:'Quotes',href:'/customer/quotes'},{id:'pending',label:'Pending',href:'/customer/quotes?status=pending_acceptance'}]}];expect(activeCompany5301Href(nav,'/customer/quotes','status=pending_acceptance','/customer')).toBe('/customer/quotes?status=pending_acceptance');expect(company5301IconRoute('/customer/bookings')).toBe('/driver/jobs');});
});