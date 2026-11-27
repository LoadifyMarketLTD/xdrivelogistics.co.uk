import { describe, expect, it } from 'vitest';
import { activeOriginal3118RouteIndex, appendAuthorised3118Routes, original3118AccountRoute } from '../app/components/workspace/original3118NavigationModel';
import { getVisibleWorkspaceNav, hasWorkspaceCapability } from '../lib/workspaceRole';

describe('T01 original 3118 cross-workspace navigation', () => {
  const sample = [
    {label:'Dashboard',href:'/admin'},
    {label:'Fleet',href:'/admin/fleet'},
    {label:'Vehicles',href:'/admin/fleet/vehicles'},
    {label:'Quotes',href:'/admin/exchange'},
  ];
  it('highlights exact routes and the deepest authorised subroute without selecting the dashboard', () => {
    expect(activeOriginal3118RouteIndex(sample,'/admin','/admin')).toBe(0);
    expect(activeOriginal3118RouteIndex(sample,'/admin/fleet/vehicles/123','/admin')).toBe(2);
    expect(activeOriginal3118RouteIndex(sample,'/admin/fleet/returns','/admin')).toBe(1);
    expect(activeOriginal3118RouteIndex(sample,'/admin/unrelated','/admin')).toBe(-1);
  });
  it('does not map a broker or driver page onto an unrelated role route', () => {
    expect(activeOriginal3118RouteIndex(sample,'/broker/loads','/admin')).toBe(-1);
    expect(activeOriginal3118RouteIndex([{label:'Today',href:'/driver'},{label:'My Jobs',href:'/driver/jobs'}],'/driver/jobs/booking','/driver')).toBe(1);
  });
  it('adds settings and notifications only when the original MAIN route-access contract permits them', () => {
    const base=[{label:'Dashboard',href:'/admin'}];
    const allowed=(href:string)=>href==='/admin/notifications';
    expect(appendAuthorised3118Routes(base,'/admin/settings','/admin/notifications',allowed)).toEqual([
      ...base, {label:'Notifications',href:'/admin/notifications'},
    ]);
    expect(appendAuthorised3118Routes(base,'/admin/settings','/admin/notifications',()=>false)).toEqual(base);
  });
  it('deduplicates shared account links and preserves established role navigation order', () => {
    const base=[{label:'Today',href:'/driver'}, {label:'Driver Settings',href:'/driver/settings'}];
    const result=appendAuthorised3118Routes(base,'/driver/settings','/driver/notifications',()=>true);
    expect(result.map(x=>x.href)).toEqual(['/driver','/driver/settings','/driver/notifications']);
  });
  it('preserves broker, driver and company-specific real account destinations',()=>{
    expect(original3118AccountRoute('broker')).toBe('/broker/account');
    expect(original3118AccountRoute('owner_driver')).toBe('/driver/settings');
    expect(original3118AccountRoute('driver')).toBe('/driver/settings');
    expect(original3118AccountRoute('fleet_manager')).toBe('/admin/settings');
  });
  it('never exposes Owner Driver commercial permissions to employed drivers',()=>{
    expect(hasWorkspaceCapability('driver','invoices.carrier.manage')).toBe(false);
    expect(hasWorkspaceCapability('owner_driver','invoices.carrier.manage')).toBe(true);
    const employed = getVisibleWorkspaceNav('driver').flatMap(group=>group.items).map(item=>item.href);
    const owner = getVisibleWorkspaceNav('owner_driver').flatMap(group=>group.items).map(item=>item.href);
    expect(employed).not.toContain('/driver/finance');
    expect(owner).toContain('/driver/finance');
  });
});
