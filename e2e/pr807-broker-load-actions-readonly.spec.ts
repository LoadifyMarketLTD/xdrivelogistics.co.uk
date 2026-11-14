import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

/** Read-only UI interactions only: no award, quote, post, send, or production writes. */
test('Broker PR807 real Loads: filter, expand, details and reset',async({page})=>{
 test.setTimeout(150000);
 const email=process.env.E2E_BROKER_EMAIL;
 const password=process.env.E2E_BROKER_PASSWORD;
 test.skip(!email||!password,'No authorised broker account');
 await loginWithCredentials(page,email!,password!);
 await page.goto('/broker/loads',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('region',{name:'Broker Loads 3150'})).toBeVisible({timeout:45000});
 const cards=page.locator('.master3150-unified-loads .master3150-record');
 await expect(cards.first()).toBeVisible({timeout:45000});
 const originalCount=await cards.count();
 expect(originalCount).toBeGreaterThan(0);
 const first=cards.first();
 const ref=await first.locator('text=/Ref: /').first().textContent();
 expect(ref).toMatch(/Ref:/);
 await first.getByRole('button',{name:'View Details'}).click();
 await expect(first.getByRole('button',{name:/Hide Details|Close Details|View Details/})).toBeVisible();
 const from=page.getByRole('textbox',{name:'FROM'});
 await from.fill('NO-MATCH-XDRIVE-807');
 await expect(cards).toHaveCount(0);
 await page.getByRole('button',{name:'Clear',exact:true}).click();
 await expect(cards.first()).toBeVisible({timeout:20000});
 expect(await cards.count()).toBe(originalCount);
 await page.getByRole('tab',{name:/Open /}).click();
 await expect(page.getByRole('tab',{name:/Open /})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:/All /}).click();
 await expect(cards.first()).toBeVisible();
});
