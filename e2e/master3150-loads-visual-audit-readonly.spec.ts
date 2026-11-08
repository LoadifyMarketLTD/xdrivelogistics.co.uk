import {test, expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

const roles=[
 {name:'customer',env:'CUSTOMER',path:'/customer/loads'},
 {name:'broker',env:'BROKER',path:'/broker/loads'},
 {name:'carrier',env:'CARRIER_ADMIN',path:'/admin/marketplace'},
 {name:'fleet',env:'FLEET_MANAGER',path:'/admin/marketplace'},
 {name:'dispatcher',env:'DISPATCHER',path:'/admin/marketplace'},
 {name:'owner-driver',env:'OWNER_DRIVER',path:'/driver/loads'},
 {name:'company-driver',env:'COMPANY_DRIVER',path:'/driver/loads'},
] as const;
for(const role of roles){
 test('3150 desktop role visual audit '+role.name,async({page})=>{
   test.setTimeout(100000);
   const email=process.env['E2E_'+role.env+'_EMAIL']||'';
   const password=process.env['E2E_'+role.env+'_PASSWORD']||'';
   test.skip(!email||!password,'No approved credentials');
   await page.setViewportSize({width:1440,height:900});
   await loginWithCredentials(page,email,password);
   await page.goto(role.path,{waitUntil:'domcontentloaded'});
   await expect(page.locator('.master3150-production').first()).toBeVisible({timeout:40000});
   const board=role.name==='customer'?page.locator('.xd-board'):page.locator('.master3150-unified-loads');
   await expect(board.first()).toBeVisible({timeout:40000});
   await page.waitForTimeout(4000);
   await page.screenshot({path:'test-results/3150-desktop-'+role.name+'.png',fullPage:false,animations:'disabled'});
   const report=await page.evaluate(()=>{
      const selectors=['.xd-board-card','.master3150-record','.workspace-filter-rail','.carrier-exchange-rail','.xd-board-filter','.driver-loads-prototype'];
      const bounds=Object.fromEntries(selectors.map(sel=>{
        const el=document.querySelector(sel);if(!el)return [sel,null];
        const r=el.getBoundingClientRect();
        return [sel,{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}];
      }));
      return {viewport:innerWidth,bodyScroll:document.documentElement.scrollWidth,bounds};
   });
   console.log('VISUAL_AUDIT '+role.name+' '+JSON.stringify(report));
   expect(report.viewport).toBe(1440);
   expect(report.bodyScroll).toBeLessThanOrEqual(1446);
 });
}
