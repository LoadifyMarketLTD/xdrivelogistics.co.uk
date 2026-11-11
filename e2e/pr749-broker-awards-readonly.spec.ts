import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

test('Broker read-only member sees Awarded Bookings but cannot access restricted Awards operations',async({page})=>{
 test.setTimeout(100000);
 const email=process.env.E2E_BROKER_EMAIL||'',password=process.env.E2E_BROKER_PASSWORD||'';
 test.skip(!email||!password,'Missing Broker credentials');
 await loginWithCredentials(page,email,password);
 const restricted=await page.goto('/broker/awards',{waitUntil:'domcontentloaded'});
 expect(restricted?.status()).toBe(200);
 await expect(page).toHaveURL(/\/broker\/?$/);
 const response=await page.goto('/broker/jobs?view=awarded',{waitUntil:'domcontentloaded'});
 expect(response?.status()).toBe(200);
 await expect(page).toHaveURL(/\/broker\/jobs\?view=awarded/);
 await expect(page.locator('[data-master-workspace="production"]')).toBeVisible({timeout:25000});
 const awarded=page.locator('.workspace-tab-strip button').filter({hasText:/Awarded/i}).first();
 await expect(awarded).toHaveAttribute('data-active','true');
 await expect(page.getByRole('button',{name:'Bookings'}).first()).toBeVisible();
});