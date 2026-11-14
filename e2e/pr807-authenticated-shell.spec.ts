import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

/** Authenticated, production-backed, read-only seven-role PR807 shell acceptance. */
const cases=[
 {role:'Customer',key:'CUSTOMER',path:'/customer/loads'},
 {role:'Broker',key:'BROKER',path:'/broker/loads'},
 {role:'Company / Carrier',key:'CARRIER_ADMIN',path:'/admin/marketplace'},
 {role:'Fleet Manager',key:'FLEET_MANAGER',path:'/admin/marketplace'},
 {role:'Dispatcher',key:'DISPATCHER',path:'/admin/marketplace'},
 {role:'Owner Driver',key:'OWNER_DRIVER',path:'/driver/loads'},
 {role:'Company Driver',key:'COMPANY_DRIVER',path:'/driver/loads'},
] as const;

for(const item of cases){
 test(`PR807 authenticated production top shell: ${item.role}`,async({page})=>{
  test.setTimeout(150000);
  const email=process.env[`E2E_${item.key}_EMAIL`];
  const password=process.env[`E2E_${item.key}_PASSWORD`];
  test.skip(!email||!password,'No authorised account');
  await loginWithCredentials(page,email!,password!);
  const response=await page.goto(item.path,{waitUntil:'domcontentloaded'});
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(item.path.replaceAll('/','\\/')+'(?:[?#]|$)'),{timeout:45000});
  const shell=page.locator('[data-master-workspace="production"]');
  await expect(shell).toBeVisible({timeout:45000});
  await expect(shell.locator('.top-workspace-shell__header')).toBeVisible();
  await expect(shell.locator('nav.top-workspace-nav')).toBeVisible();
  await expect(shell.locator('button.top-workspace-action--signout')).toBeVisible();
  await expect(shell).not.toHaveClass(/master3150-production/);
  await expect(page.locator('body')).not.toContainText('Fictional customer name');
  await expect(shell).toHaveCount(1);
 });
}
