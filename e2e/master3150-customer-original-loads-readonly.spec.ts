import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

test('Customer real-data Loads is original 3150 board with original View Details',async({page})=>{
  test.setTimeout(150000);
  const email=process.env.E2E_CUSTOMER_EMAIL||'';
  const password=process.env.E2E_CUSTOMER_PASSWORD||'';
  test.skip(!email||!password,'Missing customer test credentials');
  await loginWithCredentials(page,email,password);
  const response=await page.goto('/customer/loads',{waitUntil:'domcontentloaded'});
  expect(response?.status()).toBe(200);
  const board=page.locator('.xd-board').first();
  await expect(board).toBeVisible({timeout:40000});
  await expect(board.getByRole('heading',{name:'Loads',exact:true})).toBeVisible();
  for (const name of ['All Loads','On Demand','Same Day','Next Day','My Loads']) {
    await expect(board.getByRole('button',{name:new RegExp(name)}).first()).toBeVisible();
  }
  await expect(board.getByRole('heading',{name:'Find Loads'})).toBeVisible();
  const view=board.getByRole('button',{name:'View Details'}).first();
  await expect(view).toBeVisible({timeout:30000});
  const authorisedSheet=page.waitForResponse(r=>/\/api\/workspace\/jobs\/[^/]+\/sheet$/.test(new URL(r.url()).pathname),{timeout:30000});
  await view.click();
  const securedResponse=await authorisedSheet;
  expect(securedResponse.status()).toBe(200);
  const dialog=page.getByRole('dialog',{name:/Full details/});
  await expect(dialog).toBeVisible();
  for(const section of ['Load & Posting Company','Collection Details','Delivery Details','Vehicle & Cargo','Terms & Documents']){
    await expect(dialog.getByRole('heading',{name:section})).toBeVisible();
  }
  await expect(dialog.getByText('Full Address & Contact',{exact:true})).toHaveCount(2);
  await expect(board.getByRole('button',{name:'View Load',exact:true})).toHaveCount(0);
  await expect(board.getByRole('button',{name:'Quote Now'})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Close Details',exact:true}).click();
  await expect(dialog).toHaveCount(0);
});