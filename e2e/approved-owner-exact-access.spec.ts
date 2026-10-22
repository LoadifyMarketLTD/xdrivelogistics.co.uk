import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// Disposable routing fixture only. No customer account, contract, Stripe account,
// vehicle, bid or legal signature is changed. This is not a compliance-approval test.
test.describe.configure({mode:'serial'});
let admin:SupabaseClient;
let userId=''; let companyId='';
const suffix=randomUUID();
const email=`routing-exact-${suffix}@example.test`;
const password=randomUUID()+'!Xdrive9';
const name='Synthetic Routing Owner '+suffix;

test.beforeAll(async()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw Error('Missing E2E server configuration');
  admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,
    app_metadata:{},user_metadata:{full_name:name,role:'company_admin',signup_type:'fleet_operator',account_type:'fleet_courier',owner_driver_workspace:false}});
  if(created.error||!created.data.user)throw Error(created.error?.message??'Fixture identity failed');
  userId=created.data.user.id;
  const company=await admin.from('companies').insert({name,created_by:userId,company_type:'owner_driver',status:'active'}).select('id').single();
  if(company.error)throw Error(company.error.message);companyId=company.data.id;
  const member=await admin.from('company_memberships').upsert({company_id:companyId,user_id:userId,role_in_company:'owner',status:'active'},{onConflict:'company_id,user_id'});
  if(member.error)throw Error(member.error.message);
  // Match the server-owned identity state of an already-approved account.
  // The driver gate remains enabled and must accept this synthetic fixture.
  const identity=await admin.from('platform_identity_registry').insert({user_id:userId,company_id:companyId,
    identity_mode:'owner_driver',status:'active',verified_at:new Date().toISOString(),legal_name_normalized:name.toLowerCase()});
  if(identity.error)throw Error(identity.error.message);
  const driver=await admin.from('drivers').insert({company_id:companyId,user_id:userId,name,full_name:name,email,
    driver_type:'owner_driver',status:'active',is_active:true,app_access:true,can_commercial_bid:true,must_change_password:false}).select('status,app_access,driver_type').single();
  if(driver.error)throw Error(driver.error.message);
  expect(driver.data).toMatchObject({status:'active',app_access:true,driver_type:'owner_driver'});
  // Auth creation may leave the server-owned profile role unset. Establish only
  // this disposable fixture's canonical role; do not change any approval state.
  const profile=await admin.from('profiles').update({role:'driver',is_driver:true}).eq('user_id',userId).select('role,status').single();
  if(profile.error)throw Error(profile.error.message);
  expect(profile.data).toMatchObject({role:'driver',status:'active'});
});

test.afterAll(async()=>{
  if(!admin||!userId)return;
  const errors:string[]=[];
  // Respect the active-driver delete guard and remove only this fixture.
  const deactivated=await admin.from('drivers').update({status:'inactive',is_active:false,app_access:false}).eq('user_id',userId);
  if(deactivated.error)errors.push(deactivated.error.message);
  const drivers=await admin.from('drivers').delete().eq('user_id',userId);
  if(drivers.error)errors.push(drivers.error.message);
  const profile=await admin.from('profiles').update({company_id:null}).eq('user_id',userId);
  if(profile.error)errors.push(profile.error.message);
  for(const table of ['onboarding_applications','platform_identity_registry','company_memberships']){
    const result=await admin.from(table).delete().eq('user_id',userId);
    if(result.error)errors.push(table+': '+result.error.message);
  }
  if(companyId){
    const company=await admin.from('companies').delete().eq('id',companyId).eq('created_by',userId);
    if(company.error)errors.push(company.error.message);
  }
  const removed=await admin.auth.admin.deleteUser(userId);if(removed.error)errors.push(removed.error.message);
  if(errors.length)throw Error('Fixture cleanup failed: '+errors.join('; '));
});

for(const width of [390,1440]){
  test(`owner-driver without signup workspace flags enters own workspace at ${width}px`,async({page})=>{
    test.setTimeout(150000);await page.setViewportSize({width,height:900});
    let diagnostics=0;
    page.on('requestfailed',request=>{if(diagnostics++<35)console.log('REQUEST_FAILED',request.method(),new URL(request.url()).pathname,request.failure()?.errorText);});
    page.on('response',response=>{const pathname=new URL(response.url()).pathname;if((response.request().isNavigationRequest()||['/driver','/admin','/forbidden'].includes(pathname)) && diagnostics++<50)console.log('ROUTE_RESPONSE',response.status(),response.request().method(),pathname,'worker='+response.fromServiceWorker());});
    await page.goto('/login',{waitUntil:'domcontentloaded'});
    // Parsed HTML may precede React hydration on a cold local server. Do not
    // accidentally submit the plain HTML form before its handler is attached.
    await page.waitForFunction(()=>{const form=document.querySelector('form');if(!form)return false;
      const node=form as unknown as Record<string,{onSubmit?:unknown}>;
      return Object.keys(node).some(key=>key.startsWith('__reactProps$')&&typeof node[key]?.onSubmit==='function');});
    await page.locator('#email').fill(email);await page.locator('#password').fill(password);
    await page.locator('button[type="submit"]').click();
    if(process.env.EXPECT_OLD_OWNER_403==='true'){
      await expect(page).toHaveURL(/\/forbidden$/, {timeout:60000});return;
    }
    await expect(page).toHaveURL(/\/driver$/, {timeout:60000});
    await expect(page.getByRole('heading',{name:'Reports & Statistics',exact:true})).toBeVisible({timeout:45000});
    await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'Reports & Statistics',exact:true})).toBeVisible({timeout:45000});
    await page.goto('/admin',{waitUntil:'domcontentloaded'});
    await expect(page).toHaveURL(/\/driver$/, {timeout:60000});
    await expect(page.getByRole('heading',{name:'Reports & Statistics',exact:true})).toBeVisible({timeout:45000});
    await page.goto('/driver/vehicles',{waitUntil:'domcontentloaded'});await expect(page).toHaveURL(/\/driver\/vehicles$/);
    await expect(page.getByRole('heading',{name:'My Fleet',exact:true})).toBeVisible({timeout:45000});
    await expect(page.getByRole('tab',{name:'Vehicles',exact:true})).toHaveAttribute('aria-selected','true');
    await page.goto('/super-admin',{waitUntil:'domcontentloaded'});await expect(page).toHaveURL(/\/forbidden$/);
    await page.getByRole('link',{name:'Return Home',exact:true}).click();
    await expect(page).toHaveURL(/\/driver$/, {timeout:60000});
    await expect(page.getByRole('heading',{name:'Reports & Statistics',exact:true})).toBeVisible({timeout:45000});
    const profile=await admin.from('profiles').select('role,status').eq('user_id',userId).single();
    expect(profile.data).toMatchObject({role:'driver',status:'active'});
  });
}


test('access recovery without a session does not open a workspace', async ({ page }) => {
  await page.goto('/auth/recover-access', {waitUntil:'domcontentloaded'});
  await expect(page.locator('main').getByRole('alert')).toContainText('Sign in', {timeout:30000});
  await expect(page).toHaveURL(/\/auth\/recover-access$/);
  await expect(page.getByRole('link',{name:'Sign in with my existing account'})).toHaveAttribute('href','/login');
});
