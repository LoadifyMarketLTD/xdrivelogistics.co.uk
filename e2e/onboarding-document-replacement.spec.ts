import { expect, test } from '@playwright/test';

// UI coverage uses an existing E2E login, but all document reads/uploads below
// are intercepted. No customer document or approval is changed by this suite.
let session: Record<string, unknown>;
let storageKey: string;
test.beforeAll(async ({ request }) => {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email=process.env.E2E_OWNER_DRIVER_EMAIL;
  const password=process.env.E2E_OWNER_DRIVER_PASSWORD;
  if (!url || !key || !email || !password) throw new Error('Required E2E environment is missing.');
  const response=await request.post(url+'/auth/v1/token?grant_type=password', {
    headers:{apikey:key},data:{email,password},
  });
  expect(response.status(),'E2E authentication').toBe(200);
  const body=await response.json();
  session={...body,expires_at:Math.floor(Date.now()/1000)+body.expires_in};
  storageKey='sb-'+new URL(url).hostname.split('.')[0]+'-auth-token';
});

for (const accountType of ['owner_driver','individual_driver','fleet_courier','broker_shipper']) {
  for (const width of [390,1440]) {
    test(`${accountType} replaces own evidence at ${width}px without losing review state`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({width,height:900});
      await page.addInitScript(({key,value}) => localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value:session});
      const identity=['owner_driver','individual_driver'].includes(accountType);
      const type=identity?'right_to_work':'company_registration';
      let version=1, uploads=0;
      await page.route('**/api/onboarding/documents*', async route => {
        const request=route.request();
        expect(request.headers().authorization).toMatch(/^Bearer /);
        if (request.method()==='POST') {
          uploads+=1;
          expect(request.postData()).toContain(type);
          version+=1;
          return route.fulfill({json:{documentId:'revision-2',replaced:true,application:{status:'under_review',completion_percentage:100}}});
        }
        if (new URL(request.url()).searchParams.has('id')) {
          return route.fulfill({json:{url:'https://example.invalid/secure-preview.pdf'}});
        }
        return route.fulfill({json:{application:{id:'test-application',account_type:accountType,status:'under_review',risk_status:'clear'},documents:[
          {id:'revision-'+version,docType:type,status:'unverified',hasFile:true,uploadedAt:new Date().toISOString()},
        ]}});
      });
      await page.goto('/onboarding/documents?document='+type,{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('heading',{name:'My onboarding documents'})).toBeVisible();
      const card=page.locator('section').filter({has:page.locator('#replace-'+type)});
      await expect(card.getByRole('button',{name:/Replace /})).toBeVisible();
      await card.getByRole('button',{name:'View current document'}).click();
      await expect(page.getByRole('link',{name:'Open secure preview in a new tab'})).toHaveAttribute('target','_blank');
      await page.locator('#replace-'+type).setInputFiles({name:'corrected-evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nUI test only')});
      await expect(card.getByText('corrected-evidence.pdf')).toBeVisible();
      expect(uploads).toBe(0);
      await card.getByRole('button',{name:'Confirm replacement'}).click();
      await expect(page.getByRole('status')).toContainText('replacement uploaded successfully');
      await expect(page.getByRole('status')).toContainText('awaiting verification');
      await expect(page.locator('main')).toContainText('under review');
      expect(uploads).toBe(1);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
      expect(overflow,'No mobile horizontal overflow').toBe(false);
    });
  }
}

test('pending approval exposes document self-service without an operational workspace', async ({ page }) => {
  await page.goto('/pending-approval');
  await expect(page.getByRole('link',{name:'View or replace my documents'})).toHaveAttribute('href','/onboarding/documents');
});

test('document service refuses unauthenticated read and write', async ({ request }) => {
  expect((await request.get('/api/onboarding/documents')).status()).toBe(401);
  expect((await request.post('/api/onboarding/documents')).status()).toBe(401);
});
