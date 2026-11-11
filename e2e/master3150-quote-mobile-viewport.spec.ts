import {test,expect} from '@playwright/test';

test('3150 Loads quote drawer remains usable at narrow desktop browser viewport',async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:390,height:844});
  const result=await page.goto('/visual-fixture/loads',{waitUntil:'domcontentloaded'});
  expect(result?.status()).toBe(200);
  const quote=page.getByRole('button',{name:'Quote Now'}).first();
  await expect(quote).toBeVisible({timeout:45000});
  await expect.poll(async()=>{await quote.click();return page.getByRole('dialog',{name:'Submit marketplace quote'}).count()},{timeout:20000,intervals:[300,800,1600]}).toBe(1);
  const dialog=page.getByRole('dialog',{name:'Submit marketplace quote'});
  await expect(dialog).toBeVisible();
  const b=await dialog.boundingBox();
  expect(b).not.toBeNull();
  expect(b!.x).toBeGreaterThanOrEqual(-2);
  expect(b!.width).toBeLessThanOrEqual(392);
  const tabs=dialog.getByRole('navigation',{name:'Quote details sections'});
  await tabs.getByRole('button',{name:'Load Details'}).click();
  await expect(dialog.getByRole('heading',{name:'Complete Load Information'})).toBeVisible();
  await tabs.getByRole('button',{name:'Route & Map'}).click();
  await expect(dialog.getByRole('link',{name:'Open route in Google Maps'})).toBeVisible();
  await tabs.getByRole('button',{name:'Company'}).click();
  await expect(dialog.getByRole('heading',{name:'Posting Company'})).toBeVisible();
  await dialog.getByRole('button',{name:'Return to Quote'}).click();
  await expect(dialog.locator('#marketplace-quote-amount')).toBeVisible();
  await page.screenshot({path:'_audit/master3150-live-quote-mobile-390.png',fullPage:false});
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await expect(dialog).toHaveCount(0);
});