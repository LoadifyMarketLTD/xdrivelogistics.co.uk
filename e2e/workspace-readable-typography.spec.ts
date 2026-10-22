import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ actionTimeout: 30000, navigationTimeout: 120000 });

const roles = [
  ['customer','E2E_CUSTOMER','/customer'], ['broker','E2E_BROKER','/broker'],
  ['carrier','E2E_CARRIER_ADMIN','/admin'], ['fleet-manager','E2E_FLEET_MANAGER','/admin'],
  ['dispatcher','E2E_DISPATCHER','/admin'], ['owner-driver','E2E_OWNER_DRIVER','/driver'],
  ['company-driver','E2E_COMPANY_DRIVER','/driver'],
];

for (const [role, prefix, home] of roles) test(`${role} shared readable workspace typography`, async ({ page }) => {
  test.setTimeout(480000);
  const email=process.env[prefix+'_EMAIL'], password=process.env[prefix+'_PASSWORD'];
  if(!email||!password) throw new Error(`${role}: E2E credentials required`);
  const output=process.env.DIARY_E2E_OUTPUT;
  const report: any = {role,pages:[],menus:[],status:'running'};
  const inspect = async () => page.evaluate(() => {
    const scope=document.querySelector('.xdrive-workspace-measured');
    if(!scope) return {count:0,small:[{element:'missing-workspace-scope'}],families:[]};
    const nodes=Array.from(scope.querySelectorAll('button,a,input,select,textarea,summary,[role=button],[role=tab],[role=menuitem]'));
    const visible=(el:Element)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
    const textNodes=nodes.filter(visible).flatMap(el=>[el,...Array.from(el.querySelectorAll('span,small,strong,b,em,div,label'))].filter(node=>visible(node)&&Array.from(node.childNodes).some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim())));
    const controls=nodes.filter(visible).filter(el=>el.matches('input,select,textarea')||el.textContent?.trim());
    const checked=Array.from(new Set([...controls,...textNodes]));
    return {count:checked.length, small:checked.filter(el=>parseFloat(getComputedStyle(el).fontSize)<14).map(el=>({element:el.tagName,class:el.className,font:getComputedStyle(el).fontSize})),families:Array.from(new Set(checked.map(el=>getComputedStyle(el).fontFamily)))};
  });
  try {
    const signIn = async () => {
      report.loginAttempts ??= [];
      for (let attempt=1; attempt<=2; attempt++) {
        await page.goto('/login',{waitUntil:'domcontentloaded',timeout:120000});
        await page.waitForFunction(()=>document.querySelector('#email')||document.querySelector('.top-workspace-shell__content'),undefined,{timeout:30000});
        if(!new URL(page.url()).pathname.startsWith('/login')) {
          report.loginAttempts.push({attempt,outcome:'existing-session-restored'});
          return;
        }
        await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>null);
        const hydrated=await page.waitForFunction(()=>{const form=document.querySelector('form');return form&&Object.keys(form).some(key=>key.startsWith('__reactProps$'));},undefined,{timeout:15000}).then(()=>true).catch(()=>false);
        if(!hydrated){report.loginAttempts.push({attempt,outcome:'login-hydration-timeout'});continue;}
        await page.waitForTimeout(1000);
        if(!new URL(page.url()).pathname.startsWith('/login')) {
          report.loginAttempts.push({attempt,outcome:'existing-session-restored'});
          return;
        }
        try {
          await page.locator('#email').fill(email,{timeout:5000});
          await page.locator('#password').fill(password,{timeout:5000});
          await page.locator('button[type=submit]').first().click({timeout:5000});
        } catch(error) {
          if(!new URL(page.url()).pathname.startsWith('/login')&&await page.locator('.top-workspace-shell__content').count()) {
            report.loginAttempts.push({attempt,outcome:'existing-session-restored'});
            return;
          }
          throw error;
        }
        const outcome=await page.waitForFunction(()=>!location.pathname.startsWith('/login')?'authenticated':document.querySelector('form [role=alert]')?.textContent?.trim()?'rejected':false,undefined,{timeout:90000}).then(async h=>String(await h.jsonValue())).catch(()=>'timeout');
        report.loginAttempts.push({attempt,outcome});
        if(outcome==='authenticated') return;
      }
      throw new Error(role+': normal UI login failed; see sanitized login outcome report');
    };
    console.log(role+': login');
    await page.setViewportSize({width:1680,height:1000});
    await signIn();
    console.log(role+': dashboard');
    await page.goto(home,{timeout:120000});
    await page.locator('nav.top-workspace-nav--primary a').first().waitFor({timeout:45000});
    const workspaceLabel=await page.locator('.top-workspace-shell__identity > span').first().textContent();
    report.workspaceLabel=workspaceLabel;
    if(role==='owner-driver') expect(workspaceLabel).toContain('Owner Driver');
    if(role==='company-driver'){expect(workspaceLabel).toContain('Driver');expect(workspaceLabel).not.toContain('Owner Driver');}
    const nav=page.locator('nav.top-workspace-nav--primary');
    const routes=new Set<string>([home]);
    const collect=async()=>{for(const href of await nav.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')!)))if(href.startsWith(home))routes.add(href);};
    await collect();
    for(const trigger of await nav.locator('button[aria-haspopup=menu]').all()) {
      console.log(role+': menu');
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded','true');
      await collect();
      const result=await inspect();report.menus.push(result);expect(result.small).toEqual([]);
      await trigger.click();
    }
    // Visit every route exposed by this role's actual navigation, including More.
    for(const route of routes) {
      console.log(role+': '+route);
      await page.setViewportSize({width:1680,height:1000});
      if(route!==home) {
        let link=nav.locator(`a[href=${JSON.stringify(route)}]`);
        if(!await link.count()) {
          for(const trigger of await nav.locator('button[aria-haspopup=menu]').all()) {
            if(await trigger.getAttribute('aria-expanded')!=='true') await trigger.click();
            if(await link.count()) break;
            await trigger.click();
          }
        }
        await link.first().click();
        await page.waitForFunction(target=>location.pathname===new URL(target,location.origin).pathname||location.pathname.startsWith('/login'),route,{timeout:120000});
      }
      let response: import('@playwright/test').Response | null = null;
      await page.waitForFunction(()=>document.querySelector('.top-workspace-shell__content')||document.querySelector('#password'),undefined,{timeout:45000});
      if(new URL(page.url()).pathname.startsWith('/login')) {
        report.sessionRedirects ??= [];
        report.sessionRedirects.push({route});
        await signIn();
        response=await page.goto(route,{waitUntil:'domcontentloaded',timeout:120000});
      }
      await page.locator('.top-workspace-shell__content').waitFor({timeout:45000});
      await page.waitForLoadState('networkidle',{timeout:1500}).catch(()=>null);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(250);
      const widths=[1680,1024,390];
      for(const width of widths) {
        await page.setViewportSize({width,height:1000});
        const result=await inspect();
        report.pages.push({route,width,httpStatus:response?.status(),actualPath:new URL(page.url()).pathname,...result});
        if(response) expect(response.status(),route).toBeLessThan(400);
        await expect(page.getByRole('heading',{name:'404',exact:true})).toHaveCount(0);
        expect(page.url(),route).not.toContain('/login');
        expect(result.count,route).toBeGreaterThan(0);
        expect(result.small,`${role} ${route} ${width}`).toEqual([]);
        expect(result.families.every(f=>f.includes('HK Nova')),`${role} ${route} font family`).toBe(true);
      }
      if(output&&route===home) {
        fs.mkdirSync(output,{recursive:true});
        await page.setViewportSize({width:1680,height:1000});
        await page.screenshot({path:`${output}/${role}-dashboard.png`,fullPage:true});
      }
    }
    report.status='passed';console.log(JSON.stringify({role,routes:routes.size,measurements:report.pages.length,status:report.status}));
  } catch(error) {
    report.status='failed';
    throw error;
  } finally {
    // Credentials and session tokens never enter reports or screenshots.
    await page.evaluate(()=>document.querySelectorAll<HTMLInputElement>('#email,#password').forEach(input=>{input.value='';})).catch(()=>null);
    if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(`${output}/${role}-typography.json`,JSON.stringify(report,null,2));}
  }
});
