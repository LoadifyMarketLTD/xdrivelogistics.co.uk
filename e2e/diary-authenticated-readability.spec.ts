import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const roles = [
  ['customer','E2E_CUSTOMER','/customer/diary'],
  ['broker','E2E_BROKER','/broker/diary'],
  ['carrier','E2E_CARRIER_ADMIN','/admin/diary'],
  ['fleet-manager','E2E_FLEET_MANAGER','/admin/diary'],
  ['dispatcher','E2E_DISPATCHER','/admin/diary'],
  ['owner-driver','E2E_OWNER_DRIVER','/driver/history'],
  ['company-driver','E2E_COMPANY_DRIVER','/driver/history'],
];
const output = process.env.DIARY_E2E_OUTPUT || path.join(process.cwd(),'_audit','diary-authenticated-20261018');
fs.mkdirSync(output,{recursive:true});

for (const [role,prefix,route] of roles) {
 test(role+' authenticated Diary readability',async({page})=>{
  test.setTimeout(240000);
  const email=process.env[prefix+'_EMAIL'], password=process.env[prefix+'_PASSWORD'];
  if(!email||!password) throw new Error(role+': required credentials missing');
  const result:Record<string,unknown>={role,route,status:'running',screens:[]};
  const apiErrors:Array<{path:string,status:number}>=[];
  const authResponses:Array<{path:string,status:number}>=[];
  page.on('response',response=>{
   const url=new URL(response.url());
   if(url.pathname.startsWith('/auth/')) authResponses.push({path:url.pathname,status:response.status()});
   if((url.pathname.startsWith('/api/')||url.pathname.startsWith('/rest/')||url.pathname.startsWith('/auth/'))&&response.status()>=400)apiErrors.push({path:url.pathname,status:response.status()});
  });
  let stage='login';
  try {
   await page.setViewportSize({width:1680,height:1000});
   const fallback = role==='owner-driver' ? 'E2E_LIFECYCLE_OWNER_DRIVER' : role==='company-driver' ? 'E2E_LIFECYCLE_DRIVER' : null;
   const candidates=[prefix,...(fallback?[fallback]:[])];
   const attempts:Array<{credentialSet:string; outcome:string}>=[];
   let signedIn=false;
   for(const credentialSet of candidates) {
    const candidateEmail=process.env[credentialSet+'_EMAIL'], candidatePassword=process.env[credentialSet+'_PASSWORD'];
    if(!candidateEmail||!candidatePassword) continue;
    await page.goto('/login',{waitUntil:'domcontentloaded',timeout:120000});
    await page.locator('#email').waitFor({timeout:30000});
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
    await page.waitForFunction(() => { const form = document.querySelector('form'); return form && Object.keys(form).some(key => key.startsWith('__reactProps$')); }, undefined, { timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.locator('#email').fill(candidateEmail);
    await page.locator('#password').fill(candidatePassword);
    result.loginFieldChecks=await page.locator('form input').evaluateAll(nodes=>nodes.map(node=>{const input=node as HTMLInputElement;return {id:input.id,length:input.value.length,valid:input.validity.valid}}));
    await page.locator('button[type=submit]').first().click();
    const outcome=await page.waitForFunction(() => {
     if(!location.pathname.startsWith('/login')) return 'authenticated';
     return document.querySelector('form [role=alert]')?.textContent?.trim() ? 'login-rejected' : false;
    }, undefined, {timeout:45000}).then(async handle=>String(await handle.jsonValue())).catch(()=>'timeout');
    attempts.push({credentialSet,outcome});
    if(outcome==='login-rejected') {
     const alert=(await page.locator('form [role=alert]').first().textContent())??'';
     result.loginAlert=alert.split(candidateEmail).join('[email]').split(candidatePassword).join('[password]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[token]');
    }
    if(outcome==='authenticated'){ signedIn=true; result.credentialSet=credentialSet; break; }
   }
   result.loginAttempts=attempts;
   expect(signedIn,role+': real UI login required').toBe(true);
   stage='diary-route';
   await page.goto(route,{waitUntil:'domcontentloaded',timeout:120000});
   await expect(page).toHaveURL(new RegExp(route.replaceAll('/','\\/')+'(?:\\?|$)'),{timeout:45000});
   await expect(page.locator('input[type=password]')).toHaveCount(0);
   result.workspaceLabel=(await page.locator('.top-workspace-shell__identity > span').first().textContent())?.trim();
   if(role==='owner-driver') expect(result.workspaceLabel).toContain('Owner Driver');
   if(role==='company-driver') { expect(result.workspaceLabel).toContain('Driver'); expect(result.workspaceLabel).not.toContain('Owner Driver'); }
   const card=page.locator('.xdrive-cx-diary-card').first();
   await page.waitForFunction(() => document.querySelector('.xdrive-cx-diary-card') || Array.from(document.querySelectorAll('.owner-ref-hook-empty-state__title')).some(node => node.textContent?.includes('No bookings in this view')), undefined, { timeout: 45000 });
   const cardCount=await page.locator('.xdrive-cx-diary-card').count();
   result.cardCount=cardCount;
   result.coverage=cardCount ? 'real-booking-card' : 'authenticated-empty-state';
   if(!cardCount) {
    await expect(page.getByText('No bookings in this view', {exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Expand All Entries',exact:true})).toBeDisabled();
   }
   stage='measure';
   for(const width of [1680,1024,390]){
    await page.setViewportSize({width,height:1000});
    await page.waitForTimeout(200);
    const measurement=await page.evaluate(()=>{
     const card=document.querySelector('.xdrive-cx-diary-card');
     const rect=(el:Element|null)=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
     const fonts=(selector:string)=>Array.from(document.querySelectorAll(selector)).slice(0,30).map(el=>getComputedStyle(el).fontSize);
     const board=document.querySelector('.cx-diary-filter-rail')?.closest('.workspace-board-layout,.driver-diary-board');
     return {
      width:innerWidth,card:rect(card),columns:Array.from(card?.querySelectorAll('.xdrive-cx-diary-card__main > section')??[]).map(rect),
      rail:rect(board?.querySelector('aside')??null),main:rect(board?.querySelector(':scope > main')??null),
      fonts:{
       address:fonts('.xdrive-cx-diary-card__route strong'),date:fonts('.cx-diary-datetime > strong'),
       dateMeta:fonts('.cx-diary-datetime > span'),status:fonts('.xdrive-cx-diary-card__band'),
       label:fonts('.xdrive-cx-diary-card__route > div > span'),footer:fonts('.xdrive-cx-diary-card__footer > button'),
       filter:fonts('.cx-diary-filter-rail input:not([type=radio]):not([type=checkbox]),.cx-diary-filter-rail select'),
       filterLabel:fonts('.cx-diary-filter-rail label,.cx-diary-filter-rail .label'),filterHeader:fonts('.cx-diary-filter-rail .workspace-filter-rail__header,.cx-diary-filter-rail .left-title'),
       tabs:fonts('.cx-diary-state-tabs > button'),empty:fonts('.owner-ref-hook-empty-state__title,.xdrive-empty-state__description'),
      },
      footerLabels:Array.from(card?.querySelectorAll('.xdrive-cx-diary-card__footer > button')??[]).map(el=>el.textContent),
     };
    });
    (result.screens as unknown[]).push(measurement);
    await page.screenshot({path:path.join(output,role+'-'+width+'.png'),fullPage:true});
   }
   await page.setViewportSize({width:1680,height:1000});
   stage='expand';
   if(cardCount) {
   await card.getByRole('button',{name:'Expand booking',exact:true}).click();
   await expect(card.getByRole('button',{name:'Collapse booking',exact:true})).toHaveAttribute('aria-expanded','true');
   await expect(card.getByText(/Loading (?:job sheet|Order confirmation)/i)).toHaveCount(0,{timeout:30000});
   result.expandedFonts=await card.locator('.workspace-record-meta,.workspace-detail-item strong,.workspace-detail-item small,.workspace-detail-item > div,.workspace-tab-strip button,.driver-detail-item span,.driver-detail-item strong,.driver-detail-item small').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length>0).map(node=>getComputedStyle(node).fontSize));
   for(const size of result.expandedFonts as string[]) expect(parseFloat(size),role+' expanded text').toBeGreaterThanOrEqual(14);
   await page.screenshot({path:path.join(output,role+'-expanded.png'),fullPage:true});
   result.expanded=true;
   await card.getByRole('button',{name:'Collapse booking',exact:true}).click();
   await expect(card.getByRole('button',{name:'Expand booking',exact:true})).toHaveAttribute('aria-expanded','false');
   result.collapsed=true;
   }
   stage='assert-fonts';
   for(const measurement of result.screens as any[]){
    if(measurement.card) expect(measurement.card.x+measurement.card.width,role+' card right edge '+measurement.width).toBeLessThanOrEqual(measurement.width+1);
    for(const key of ['address','date','status'])for(const size of measurement.fonts[key])expect(size,role+' '+key).toBe('16px');
    for(const key of ['dateMeta','label','footer','filter','filterLabel','filterHeader','tabs','empty'])for(const size of measurement.fonts[key])expect(size,role+' '+key).toBe('14px');
   }
   result.status='passed';
  }catch(error){
   result.status='failed';result.stage=stage;
   // Do not persist Playwright login call logs: they can contain typed credentials.
   result.errorType=error instanceof Error?error.name:'Error';
   throw new Error(role+': verification failed at '+stage+'; inspect sanitized measurements');
  }finally{
   if(new URL(page.url()).pathname.startsWith('/login')) {
    await page.locator('#password').fill('',{timeout:3000}).catch(()=>null);
    await page.locator('#email').fill('',{timeout:3000}).catch(()=>null);
   }
   result.apiErrors=apiErrors;
   result.authResponses=authResponses;
   result.actualPath=new URL(page.url()).pathname;
   if(result.status==='failed'&&!String(result.actualPath).startsWith('/login')) await page.screenshot({path:path.join(output,role+'-failure.png')}).catch(()=>null);
   fs.writeFileSync(path.join(output,role+'.json'),JSON.stringify(result,null,2));
  }
 });
}
