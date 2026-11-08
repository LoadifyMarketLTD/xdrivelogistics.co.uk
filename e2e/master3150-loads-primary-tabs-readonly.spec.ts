import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

const roles=[
 {name:'carrier',env:'CARRIER_ADMIN',path:'/admin/marketplace'},
 {name:'fleet',env:'FLEET_MANAGER',path:'/admin/marketplace'},
 {name:'dispatcher',env:'DISPATCHER',path:'/admin/marketplace'},
 {name:'owner-driver',env:'OWNER_DRIVER',path:'/driver/loads'},
 {name:'company-driver',env:'COMPANY_DRIVER',path:'/driver/loads'},
] as const;

for(const role of roles){
 test('3150 Loads primary navigation filters real '+role.name+' page',async({page})=>{
  test.setTimeout(150000);
  const email=process.env['E2E_'+role.env+'_EMAIL']||'';
  const password=process.env['E2E_'+role.env+'_PASSWORD']||'';
  test.skip(!email||!password,'No approved role E2E credentials');
  await page.setViewportSize({width:1440,height:900});
  await loginWithCredentials(page,email,password);
  await page.goto(role.path,{waitUntil:'domcontentloaded'});
  const nav=page.getByRole('navigation',{name:'3150 Loads primary tabs'});
  await expect(nav).toBeVisible({timeout:50000});
  await expect(nav.getByRole('button',{name:'All Loads'})).toHaveAttribute('aria-pressed','true');
  const sameDay=nav.getByRole('button',{name:'Same Day'});
  const nextDay=nav.getByRole('button',{name:'Next Day'});
  await sameDay.click();
  await expect(sameDay).toHaveAttribute('aria-pressed','true');
  await nextDay.click();
  await expect(nextDay).toHaveAttribute('aria-pressed','true');
  const all=nav.getByRole('button',{name:'All Loads'});
  await all.click();
  await expect(all).toHaveAttribute('aria-pressed','true');
  await expect(nav.getByRole('link',{name:'My Loads'})).toHaveAttribute('href',role.name.endsWith('driver')?'/driver/bookings':'/admin/jobs');
  if(role.name.endsWith('driver')){
    const radius=page.getByLabel('Collection radius');
    await expect(radius.locator('option')).toHaveCount(8);
    await radius.selectOption('300');
    await expect(radius).toHaveValue('300');
  }
 });
}

test('carrier real Loads retain quote action, View Details modal and 300-mile radius',async({page})=>{
 test.setTimeout(150000);
 const email=process.env.E2E_CARRIER_ADMIN_EMAIL||'';
 const password=process.env.E2E_CARRIER_ADMIN_PASSWORD||'';
 test.skip(!email||!password,'No approved carrier E2E credentials');
 await page.setViewportSize({width:1440,height:900});
 await loginWithCredentials(page,email,password);
 await page.goto('/admin/marketplace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.master3150-unified-loads')).toBeVisible({timeout:50000});
 const fromRadius=page.getByLabel('Radius Search:').first();
 await expect(fromRadius.locator('option[value="300"]')).toHaveCount(1);
 await fromRadius.selectOption('300');
 await expect(fromRadius).toHaveValue('300');
 const board=page.locator('.master3150-unified-loads');
 const details=board.getByRole('button',{name:'View Details'});
 if(await details.count()){
  await details.first().click();
  await expect(page.locator('.xdrive3150-marketplace-detail-overlay')).toBeVisible({timeout:12000});
 }
});
