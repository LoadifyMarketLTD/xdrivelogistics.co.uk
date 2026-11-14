import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

/** Read-only production-connected shell acceptance. Never mutate live jobs. */
const cases=[
 {role:'Broker',key:'BROKER',path:'/broker/loads'},
 {role:'Fleet Manager',key:'FLEET_MANAGER',path:'/admin/marketplace'},
 {role:'Dispatcher',key:'DISPATCHER',path:'/admin/marketplace'},
] as const;

for(const item of cases){
 test(`PR807 authenticated production shell: ${item.role}`,async({page})=>{
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
  // The mobile menu toggle is intentionally hidden from the desktop accessibility tree.
  await expect(shell.locator('button[aria-label="Open workspace menu"]')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('Fictional customer name');
  expect(await page.locator('[data-master-workspace="production"]').count()).toBe(1);
  await expect(page.getByRole('complementary',{name:'Master workspace sections'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Loads',exact:true}).first()).toBeVisible();
 });
}
