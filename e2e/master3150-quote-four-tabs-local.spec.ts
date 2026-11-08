import {test,expect} from '@playwright/test';

test('real-backed quote UI reuses the approved 3150 four-tab structure (fixture data only)',async({page})=>{
 test.setTimeout(180000);
 await page.setViewportSize({width:1365,height:900});
 const res=await page.goto('/visual-fixture/loads',{waitUntil:'domcontentloaded'});
 expect(res?.status()).toBe(200);
 const button=page.getByRole('button',{name:'Quote Now'}).first();
 await expect(button).toBeVisible({timeout:60000});
 await expect.poll(async () => {
   await button.click();
   return await page.getByRole('dialog',{name:'Submit marketplace quote'}).count();
 }, {timeout:20000, intervals:[300,600,1000]}).toBe(1);
 const dialog=page.getByRole('dialog',{name:'Submit marketplace quote'});
 await expect(dialog).toBeVisible();
 const cssMetrics=await page.evaluate(()=>{
  const selectors=['.xd-quote-top','.xd-quote-top h2','.xd-quote-route','.xd-quote-nav','.xd-quote-info section','.xd-quote-form h3','.xd-quote-form input','.xd-quote-form select','.xd-quote-form textarea','.xd-quote-submit','.xd-quote-bottom button'];
  return Object.fromEntries(selectors.map(sel=>{const el=document.querySelector(sel);if(!el)return [sel,null];const rect=el.getBoundingClientRect(),css=getComputedStyle(el);return [sel,{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height),font:css.fontSize,padding:css.padding,fontWeight:css.fontWeight}]}));
 });
 console.log('QUOTE_VISUAL_METRICS='+JSON.stringify(cssMetrics));
 const panelBounds=await dialog.boundingBox();
 expect(panelBounds).not.toBeNull();
 expect(Math.abs(panelBounds!.y)).toBeLessThan(3);
 expect(Math.abs(panelBounds!.width-950)).toBeLessThan(3);
 expect(Math.abs(panelBounds!.x+panelBounds!.width-1365)).toBeLessThan(3);
 await page.screenshot({path:'_audit/master3150-live-quote-local.png',fullPage:false});
 const nav=dialog.getByRole('navigation',{name:'Quote details sections'});
 for(const tab of ['Quote','Load Details','Route & Map','Company']) await expect(nav.getByRole('button',{name:tab,exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Load Details'}).click();
 await expect(dialog.getByRole('heading',{name:'Complete Load Information'})).toBeVisible();
 await expect(dialog.getByText('Full address and contact are disclosed after award.').first()).toBeVisible();
 await nav.getByRole('button',{name:'Route & Map'}).click();
 await expect(dialog.getByRole('heading',{name:'Collection and Delivery Route'})).toBeVisible();
 await expect(dialog.getByRole('link',{name:'Open route in Google Maps'})).toHaveAttribute('rel','noopener noreferrer');
 await nav.getByRole('button',{name:'Company'}).click();
 await expect(dialog.getByRole('heading',{name:'Posting Company'})).toBeVisible();
 await dialog.getByRole('button',{name:'Return to Quote'}).click();
 await expect(dialog.getByText('Payment Terms')).toBeVisible();
 await expect(dialog.getByText('ETA to Collection *')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Submit Quote'})).toBeDisabled();
 await dialog.locator('#marketplace-quote-amount').fill('80');
 await dialog.locator('.xd-quote-eta').selectOption('30');
 await expect(dialog.getByRole('button',{name:'Submit Quote'})).toBeEnabled();
 // Deliberately DO NOT submit; this suite is visual/read-only.
 await dialog.getByRole('button',{name:'Cancel'}).click();
 await expect(dialog).toHaveCount(0);
});