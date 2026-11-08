import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

/** Authorised-only read checks. Never post, quote, award or alter real loads. */
const workspaces = [
 {role:'Customer',env:'CUSTOMER',path:'/customer/loads',original:true},
 {role:'Broker',env:'BROKER',path:'/broker/loads',original:false},
 {role:'Company / Carrier',env:'CARRIER_ADMIN',path:'/admin/marketplace',original:false},
 {role:'Fleet Manager',env:'FLEET_MANAGER',path:'/admin/marketplace',original:false},
 {role:'Dispatcher',env:'DISPATCHER',path:'/admin/marketplace',original:false},
 {role:'Owner Driver',env:'OWNER_DRIVER',path:'/driver/loads',original:false},
 {role:'Company Driver',env:'COMPANY_DRIVER',path:'/driver/loads',original:false},
] as const;

for(const {role,env,path,original} of workspaces){
 test(`approved Master3150 Loads in ${role}, actual authenticated records`,async({page})=>{
  test.setTimeout(150000);
  const email=process.env[`E2E_${env}_EMAIL`]||'';
  const password=process.env[`E2E_${env}_PASSWORD`]||'';
  test.skip(!email||!password,`No authorised ${role} test account`);
  await loginWithCredentials(page,email,password);
  const response=await page.goto(path,{waitUntil:'domcontentloaded'});
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe(path);
  await expect(page.locator('.master3150-production').first()).toBeVisible({timeout:45000});
  if(original){
   await expect(page.locator('.xd-board').first()).toBeVisible({timeout:45000});
   await expect(page.getByText('Find Loads',{exact:true}).first()).toBeVisible();
  }else{
   await expect(page.locator('.master3150-unified-loads').first()).toBeVisible({timeout:45000});
   const cards=page.locator('.master3150-unified-loads .master3150-record');
   const n=await cards.count();
   if(n>0){
    const measurements=await cards.first().evaluate(el=>{
     const r=el.getBoundingClientRect();
     return {width:r.width,height:r.height,viewport:document.documentElement.clientWidth};
    });
    expect(measurements.width).toBeGreaterThan(180);
    expect(measurements.height).toBeGreaterThanOrEqual(150);
    expect(measurements.width).toBeLessThan(measurements.viewport+1);
   }
  }
  await expect(page.locator('body')).not.toContainText('Fictional customer name');
 });
}
