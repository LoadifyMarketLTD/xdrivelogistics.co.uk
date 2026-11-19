import {describe,it,expect} from 'vitest';
import {organisationForCompany5301,activeCompany5301Href} from '../app/components/workspace/companyAdmin5301Navigation';
import {composeCompanyAdminSidebarNav} from '../app/components/workspace/companyAdminSidebarNav';
const groups=composeCompanyAdminSidebarNav([{id:'allowed',label:'Allowed',items:['/admin','/admin/action-centre','/admin/fleet/vehicles','/admin/drivers','/admin/vehicles','/admin/fleet/returns','/admin/jobs','/admin/settings','/admin/messages'].map((href,i)=>({id:String(i),href,label:href}))}]);
describe('5301 Company Admin sidebar adapter',()=>{
 it('retains grouped ordering and one fleet entry',()=>{const sections=organisationForCompany5301(groups);expect(sections.map(g=>g.label)).toEqual(['Overview','Operations','My resources','Communication','Account']);expect(sections.find(g=>g.label==='My resources')?.items.map(i=>i.label)).toEqual(['My Fleet']);expect(sections.flatMap(g=>g.items).some(i=>i.href.startsWith('/driver'))).toBe(false)});
 it('selects My Fleet for authorized subpages and the longest separate route otherwise',()=>{expect(activeCompany5301Href(groups,'/admin/drivers','manage=1')).toBe('/admin/fleet/vehicles');expect(activeCompany5301Href(groups,'/admin/fleet/returns','')).toBe('/admin/fleet/returns');expect(activeCompany5301Href(groups,'/admin/jobs/abc','')).toBe('/admin/jobs');expect(activeCompany5301Href(groups,'/admin/unknown','')).toBeNull()});
 it('renders no unauthorized links',()=>expect(organisationForCompany5301([])).toEqual([]));
});