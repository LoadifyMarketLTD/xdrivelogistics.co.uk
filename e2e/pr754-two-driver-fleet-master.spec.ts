import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';
for(const role of [
 {name:'Owner Driver',prefix:'E2E_OWNER_DRIVER',canManage:true},
 {name:'Company Driver',prefix:'E2E_COMPANY_DRIVER',canManage:false},
] as const)test(`${role.name} receives proper canonical 3150 Fleet navigation`,async({page})=>{
 test.setTimeout(120000);
 const email=process.env[role.prefix+'_EMAIL']||'',password=process.env[role.prefix+'_PASSWORD']||'';
 test.skip(!email||!password,'Missing account');
 await loginWithCredentials(page,email,password);
 const res=await page.goto('/driver/jobs',{waitUntil:'domcontentloaded'});
 expect(res?.status()).toBe(200);
 const myFleet=page.getByRole('button',{name:'My Fleet'}).first();
 await expect(myFleet).toBeVisible({timeout:30000});
 if(role.canManage){
  await expect(myFleet).toBeEnabled();
  await myFleet.click();
  await expect(page).toHaveURL(/\/driver\/fleet/);
  const board=page.locator('[data-master-fleet="3150-canonical-real"]').first();
  await expect(board).toBeVisible({timeout:30000});
  await expect(board.getByRole('button',{name:/Add Vehicle/})).toBeEnabled();
 }else{
  await expect(myFleet).toBeDisabled();
  const deepLink=await page.goto('/driver/fleet',{waitUntil:'domcontentloaded'});
  expect(deepLink?.status()).toBe(200);
  await expect(page).toHaveURL(/\/driver\/jobs/);
  await expect(page.getByRole('button',{name:'My Fleet'}).first()).toBeDisabled();
 }
});