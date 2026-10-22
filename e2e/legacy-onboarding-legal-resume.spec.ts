import { test, expect } from '@playwright/test';
import { buildCurrentLegalRequirement } from '../lib/legal/legalAgreementState';

// Real read-only authentication uses the existing, authorised E2E account.
// UI fixtures below intercept onboarding/legal data; no customer or test
// account is created/modified and no legal acceptance is submitted.
// Worker-owned requests bypass Playwright page routing. Block them only in
// this fixture suite so simulated evidence never falls through to real data.
test.use({ serviceWorkers: 'block' });
let session:Record<string,any>;
let storageKey:string;
test.beforeAll(async({request})=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email=process.env.E2E_OWNER_DRIVER_EMAIL,password=process.env.E2E_OWNER_DRIVER_PASSWORD;
  if(!url||!key||!email||!password)throw Error('Missing authorised E2E environment.');
  const response=await request.post(url+'/auth/v1/token?grant_type=password',{headers:{apikey:key},data:{email,password}});
  expect(response.status()).toBe(200);const data=await response.json();
  session={...data,expires_at:Math.floor(Date.now()/1000)+data.expires_in};
  storageKey='sb-'+new URL(url).hostname.split('.')[0]+'-auth-token';
});

test('published resume endpoint accepts authenticated read-only resume without recording consent',async({request})=>{
  const response=await request.post('/api/onboarding/init',{headers:{Authorization:'Bearer '+session.access_token},data:{resumeOnly:true}});
  expect(response.status()).toBe(200);expect(await response.json()).toMatchObject({resumeAllowed:true,legalEvidenceRecorded:false,invitationRegenerated:false});
  expect(response.headers()['cache-control']).toContain('no-store');
});
const cases=[['owner_driver','owner-driver','owner_operator'],['fleet_courier','fleet','fleet_operator'],['broker_shipper','broker','transport_broker'],['customer_shipper','customer','customer_shipper']] as const;
for(const [kind,segment,role] of cases){
  for(const width of [390,1440]){
    test(`legacy ${kind} fixture reaches unchecked agreement form at ${width}px`,async({page})=>{
      test.setTimeout(90000);await page.setViewportSize({width,height:900});
      await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value:session});
      const application={id:'fixture-legacy-application',user_id:session.user.id,account_type:kind,status:'in_progress',company_id:null,
        current_step:'document_upload',completion_percentage:60,payload:{full_name:'Saved Applicant',contact_person:'Saved Applicant',email:'fixture@example.test'}};
      await page.route('**/api/onboarding/**',async route=>{
        if(new URL(route.request().url()).pathname==='/api/onboarding/init'){
          expect(route.request().postDataJSON()).toMatchObject({resumeOnly:true});
          return route.fulfill({json:{onboardingApplicationId:application.id,accountType:kind,status:'in_progress',resumeAllowed:true}});
        }
        if(route.request().method()!=='GET')throw Error('Fixture must not mutate onboarding.');
        return route.fulfill({json:{application}});
      });
      await page.route('**/api/account/legal-agreements*',async route=>{
        if(route.request().method()!=='GET')throw Error('No consent is submitted by this test.');
        return route.fulfill({json:{context:{userId:session.user.id,companyId:null,onboardingApplicationId:application.id},
          currentRequirement:buildCurrentLegalRequirement(role,'en'),requiresReacceptance:true,reacceptanceReasons:['legal_version_changed'],
          history:[{id:'old-evidence',registrationRole:role,legalVersion:'2026-09-04',agreements:[],privacyVersion:'2026-09-01',acceptanceLanguage:'legacy',
            acceptedAt:'2026-09-27T19:10:27Z',createdAt:'2026-09-27T19:10:27Z',source:'registration',evidenceHash:'fixture-hash',signedPdfAvailable:false,status:'superseded'}]}});
      });
      await page.goto('/onboarding/resume',{waitUntil:'domcontentloaded'});
      await expect(page).toHaveURL(new RegExp('/onboarding/'+segment+'/resume$'),{timeout:30000});
      await expect(page.getByRole('heading',{name:'Legal & Agreements',exact:true})).toBeVisible({timeout:20000});
      await expect(page.getByText('Current contractual requirement',{exact:true})).toBeVisible({timeout:20000});
      await expect(page.getByRole('button',{name:'Review selected documents & continue to signature'})).toBeDisabled();
      const panel=page.locator('section[aria-label="Read, accept and sign onboarding agreements"]');
      for(const check of await panel.locator('input[type="checkbox"]').all())await expect(check).not.toBeChecked();
      await expect(panel).toContainText('2026-09-04');
      await page.reload();await expect(page.getByText('Current contractual requirement',{exact:true})).toBeVisible({timeout:20000});
      await expect(page.getByText('Registration legal acceptance evidence is incomplete or does not match the active XDrive agreement versions.',{exact:true})).toHaveCount(0);
    });
  }
}
test('unauthenticated callers cannot resume or load private agreements',async({request})=>{
  expect((await request.post('/api/onboarding/init',{data:{resumeOnly:true}})).status()).toBe(401);
  expect((await request.get('/api/account/legal-agreements')).status()).toBe(401);
});
