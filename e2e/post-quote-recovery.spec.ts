import {expect,test,type Page} from '@playwright/test';
import {mockWorkspace,COMPANY} from './helpers/workspaceRecoveryFixtures';
test.use({serviceWorkers:'block'});
test.skip(process.env.E2E_VISUAL_FIXTURE!=='true','Local-only mocked services.');
async function fillLoad(page:Page){
 const date=new Date();date.setDate(date.getDate()+2);
 await page.locator('input[type="date"]').first().fill(date.toISOString().slice(0,10));
 await page.getByRole('combobox',{name:'Time *',exact:true}).first().selectOption('10:00');
 await page.getByPlaceholder('e.g. BB1 1AA').nth(0).fill('BB1 1AA');await page.getByPlaceholder('e.g. BB1 1AA').nth(1).fill('M1 1AA');
 await page.locator('textarea').nth(0).fill('Keep collection details');await page.locator('textarea').nth(1).fill('Keep delivery details');
}
for(const role of ['carrier','customer','broker','owner'] as const){
 test(role+': blocked publish offers workspace-specific legal recovery without erasing draft',async({page},info)=>{
  await mockWorkspace(page,role);await page.goto('/visual-fixture/workspace-recovery/'+role+'?screen=post-load');await expect(page.getByTestId('fixture-user')).toHaveText(COMPANY,{timeout:20000});await fillLoad(page);
  await page.getByRole('button',{name:'Publish Load',exact:true}).click();
  const action=page.getByRole('link',{name:'Review legal agreements',exact:true});
  const expected=role==='carrier'?'/admin/settings/legal-agreements':role==='owner'?'/driver/account/legal-agreements':'/'+role+'/account/legal-agreements';
  await expect(action).toHaveAttribute('href',expected);await expect(action).toHaveAttribute('target','_blank');await expect(page.locator('textarea').first()).toHaveValue('Keep collection details');
  await page.screenshot({path:info.outputPath(role+'-post-remediation.png'),fullPage:true});
 });
}
for(const kind of ['stripe','legal'])test('carrier quote dialog: '+kind+' recovery visible inside modal, draft retained',async({page})=>{
 await mockWorkspace(page,'carrier');let denied=false;let writes=0;
 const job={id:'55555555-5555-4555-8555-555555555555',company_id:'66666666-6666-4666-8666-666666666666',pickup_postcode:'BB1',pickup_location:'Blackburn',delivery_postcode:'M1',delivery_location:'Manchester',pickup_datetime:new Date(Date.now()+86400000).toISOString(),requested_vehicle_label:'Luton',posterName:'Fixture Posting Company',posterMemberCode:'XD-TEST-002',currency:'GBP',weight_kg:500,pallets:4,myBid:null,jobDescription:'Timed transport',loadType:'on_demand'};
 await page.route('**/api/marketplace/company**',route=>{
  if(route.request().method()==='POST'){denied=true;writes++;return route.fulfill({status:409,json:{error:'Fixture '+kind+' restriction'}});}
  return route.fulfill({json:{rows:[job],total:1,totalPages:1,page:1}});
 });
 const blocker=kind==='stripe'?{code:'STRIPE_COMMERCIAL_READINESS_REQUIRED',title:'Company Stripe setup is incomplete',message:'Activate the company account.',operation:'commercial',actionType:'stripe_setup',actionLabel:'Complete Stripe setup',companyId:COMPANY}:{code:'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED',title:'Legal agreements must be accepted',message:'Review company agreements.',operation:'commercial',actionType:'link',actionLabel:'Review & accept agreements',actionHref:'/admin/settings/legal-agreements'};
 await page.route('**/api/workspace/readiness**',route=>route.fulfill({json:{ready:!denied,blockers:denied?[blocker]:[]}}));
 await page.goto('/visual-fixture/workspace-recovery/carrier?screen=quotes');await page.getByRole('button',{name:'Quote Now',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Submit marketplace quote'});await dialog.locator('input[type="number"]').fill('225');await dialog.locator('textarea').fill('Keep my quote message');await dialog.getByRole('button',{name:'Submit Quote',exact:true}).click();
 await expect(dialog).toContainText('Fixture '+kind+' restriction');
 if(kind==='stripe')await expect(dialog.getByRole('button',{name:'Set up / activate Stripe'})).toBeVisible();else await expect(dialog.getByRole('link',{name:'Review & accept agreements'})).toBeVisible();
 await expect(dialog.locator('textarea')).toHaveValue('Keep my quote message');await expect(dialog.locator('input[type="number"]')).toHaveValue('225');expect(writes).toBe(1);
});
