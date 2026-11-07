import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

test('Master fleet API denies authenticated access to a different real company', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const email=process.env.E2E_CUSTOMER_EMAIL||'';
  const password=process.env.E2E_CUSTOMER_PASSWORD||'';
  const candidates=(process.env.E2E_FOREIGN_COMPANY_IDS||'').split(',').filter(Boolean);
  test.skip(!email||!password||candidates.length===0,'Separate real company identifiers and account required');
  await loginWithCredentials(page,email,password);
  const responsePromise=page.waitForResponse(r=>r.url().includes('/api/workspace/fleet-overview?') && r.status()===200 && r.request().method()==='GET',{timeout:30000});
  await page.goto('/customer/fleet',{waitUntil:'domcontentloaded'});
  const ownResponse=await responsePromise;
  const own=await ownResponse.json() as {companyId:string};
  const headers=await ownResponse.request().allHeaders();
  const authorization=headers.authorization;
  expect(authorization).toMatch(/^Bearer\s+\S+/i);
  const foreign=candidates.find(id=>id!==own.companyId);
  test.skip(!foreign,'No company separate from the authenticated tenant');
  const denied=await page.request.get((baseURL||'https://www.xdrivelogistics.co.uk')+'/api/workspace/fleet-overview?companyId='+encodeURIComponent(foreign!),{headers:{Authorization:authorization}});
  console.log(JSON.stringify({test:'foreign-company-read',status:denied.status()}));
  expect(denied.status()).toBe(403);
  const body=await denied.text();
  expect(body).not.toContain('reg_plate');
});
