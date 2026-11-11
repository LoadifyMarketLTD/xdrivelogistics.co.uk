import {describe,expect,it} from 'vitest';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MASTER_AUTHENTICATED_ROUTES,masterNavigationHref} from '../lib/masterWorkspaceNavigation';

describe('Authenticated Master route mapping is not trapped on retired web pages',()=>{
 it('uses the published Company 3150 Loads and unified Quotes pages',()=>{
   for(const role of ['Company / Carrier','Fleet','Dispatcher'] as const){
     expect(masterNavigationHref(role,2)).toBe('/admin/marketplace');
     expect(masterNavigationHref(role,3)).toBe('/admin/exchange');
     expect(masterNavigationHref(role,12)).toBe('/admin/fleet/returns');
     expect(masterNavigationHref(role,16)).toBe('/admin/reports');
   }
 });
 it('makes all role-appropriate Customer and Broker pages navigable',()=>{
   for(const [role,prefix] of [['Customer','/customer'],['Broker','/broker']] as const){
     for(const tab of [5,6,10,11,12,13,16]){
       const href=masterNavigationHref(role,tab);
       expect(href,role+' tab '+tab).toBeTruthy();
       expect(href?.startsWith(prefix+'/')).toBe(true);
       if(href){
         const file=fileURLToPath(new URL('../app'+href+'/page.tsx',import.meta.url));
         expect(existsSync(file),role+' missing '+file).toBe(true);
       }
     }
   }
 });
 it('keeps the fixed 17-tab index order for every workspace role',()=>{
   for(const [role,paths] of Object.entries(MASTER_AUTHENTICATED_ROUTES)){
     expect(paths.length,role+' Master section count').toBe(17);
   }
 });
});
