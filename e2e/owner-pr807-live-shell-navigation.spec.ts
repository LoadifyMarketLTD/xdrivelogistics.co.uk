import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

test('real Owner Driver: main shell links, More, Post Load and Book Direct navigation', async ({ page }) => {
  test.setTimeout(190_000);
  const email = process.env.E2E_OWNER_DRIVER_EMAIL ?? '';
  const password = process.env.E2E_OWNER_DRIVER_PASSWORD ?? '';
  test.skip(!email || !password, 'Real Owner Driver credentials required');
  const blocked: string[] = [];
  await page.route('**/*', async route => {
    const r = route.request(), u = new URL(r.url());
    if (['GET','HEAD','OPTIONS'].includes(r.method())) return route.continue();
    if (u.hostname.endsWith('.supabase.co') && (u.pathname.startsWith('/auth/v1/') || u.pathname === '/rest/v1/rpc/active_company_membership_role')) return route.continue();
    blocked.push(r.method() + ' ' + u.pathname);
    return route.fulfill({status:403,contentType:'application/json',body:'{"error":"READ_ONLY_OWNER_NAV_TEST"}'});
  });
  await loginWithCredentials(page,email,password);
  await page.goto('/driver',{waitUntil:'domcontentloaded'});
  const nav = page.locator('nav.top-workspace-nav--primary');
  await expect(nav).toBeVisible({timeout:30000});
  await page.waitForTimeout(1600);
  const targets: Array<[string,string]> = [
    ['Dashboard','/driver'],['Action Centre','/driver/action-centre'],
    ['Directory','/driver/directory'],['Live Availability','/driver/availability/live'],
    ['My Fleet','/driver/fleet'],['Return Journeys','/driver/returns'],
    ['Loads','/driver/loads'],['Quotes','/driver/quotes'],
    ['My Jobs','/driver/jobs'],['Diary','/driver/history'],
    ['Settings','/driver/settings'],
  ];
  for (const [label,href] of targets) {
    if (new URL(page.url()).pathname === href) continue;
    const link = nav.locator('a[href="'+href+'"]');
    await expect(link,label+' nav link').toBeVisible({timeout:12000});
    await link.click();
    await expect(page,label+' route').toHaveURL(url => url.pathname === href,{timeout:25000});
  }
  await page.goto('/driver',{waitUntil:'domcontentloaded'});
  const more = nav.getByRole('button',{name:/^More$/i});
  await expect(more).toBeVisible();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('menuitem').first()).toBeVisible({timeout:10000});
  const menuEntries = await page.getByRole('menuitem').allTextContents();
  expect(menuEntries.length).toBeGreaterThanOrEqual(5);
  await page.keyboard.press('Escape');
  await expect(more).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:'POST LOAD'}).click();
  await expect(page).toHaveURL(/\/driver\/post-load(?:\?|$)/,{timeout:15000});
  await expect(page.locator('.xdrive-post-load-form')).toBeVisible({timeout:30000});
  await page.goto('/driver',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'BOOK DIRECT'}).click();
  // BOOK DIRECT opens the authorised carrier/member Directory; the actual direct
  // booking action is selected from an eligible member there.
  await expect(page).toHaveURL(/\/driver\/directory(?:\?|$)/,{timeout:15000});
  await expect(page.locator('body')).toContainText(/Directory|Members|Companies/i,{timeout:15000});
  console.log('OWNER_PR807_NAVIGATION_SUCCESS='+JSON.stringify({mainLinks:targets.length,moreItems:menuEntries.length,interceptedNonAuthWrites:blocked.length}));
});
