import {expect,test} from '@playwright/test';
import {mockWorkspace,COMPANY} from './helpers/workspaceRecoveryFixtures';
test.use({serviceWorkers:'block'});
test.skip(process.env.E2E_VISUAL_FIXTURE!=='true','Local-only isolated services.');
const DRIVER='33333333-3333-4333-8333-333333333333';const VEHICLE='44444444-4444-4444-8444-444444444444';
for(const role of ['owner','driver'] as const){for(const docType of ['mot','insurance']){
 test(role+': targeted '+docType+' upload remains pending verification',async({page},info)=>{
  await mockWorkspace(page,role);await page.setViewportSize({width:390,height:844});let uploaded=false;let writes=0;
  await page.route('**/api/driver/vehicle-readiness**',async route=>{
   if(route.request().method()==='POST'){writes++;expect(route.request().postData()).toContain(VEHICLE);expect(route.request().postData()).toContain(docType);uploaded=true;return route.fulfill({status:201,json:{review:'pending',document:{id:'doc',status:'pending'}}});}
   return route.fulfill({json:{companyId:COMPANY,driverId:DRIVER,canManageAssignment:role==='owner',vehicles:[{id:VEHICLE,reg_plate:'TEST 123',type:'luton',status:'active',assigned_driver_id:DRIVER}],documents:uploaded?[{id:'doc',vehicle_id:VEHICLE,doc_type:docType,status:'pending',expiry_date:'2099-01-01'}]:[]}});
  });
  await page.goto('/visual-fixture/workspace-recovery/'+role+'?screen=vehicle-readiness&document='+docType);
  await expect(page.getByRole('combobox',{name:'Document type',exact:true})).toHaveValue(docType,{timeout:20000});await expect(page.locator('#vehicle-document-file')).toBeFocused();
  await page.getByLabel('Expiry date',{exact:true}).fill('2099-01-01');
  await page.locator('#vehicle-document-file').setInputFiles({name:'evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 fixture evidence')});
  await page.getByRole('button',{name:'Submit vehicle document for verification'}).click();
  await expect(page.getByText('Document submitted. Pending verification:',{exact:false})).toBeVisible();expect(writes).toBe(1);
  if(role==='driver')await expect(page.getByRole('button',{name:'Remove assignment'})).toHaveCount(0);
  expect(await page.getByRole('region',{name:'Upload vehicle document'}).evaluate(el=>el.scrollWidth-el.clientWidth)).toBe(0);
  await page.screenshot({path:info.outputPath(role+'-'+docType+'-pending.png'),fullPage:true});
 });
}}
test('owner directly assigns one available company vehicle without posting work',async({page})=>{
 await mockWorkspace(page,'owner');let assigned=false;let writes=0;
 await page.route('**/api/driver/vehicle-readiness**',async route=>{
  if(route.request().method()==='PATCH'){writes++;expect(route.request().postDataJSON()).toEqual({vehicleId:VEHICLE,action:'assign'});assigned=true;return route.fulfill({json:{message:'Vehicle assignment saved.'}});}
  return route.fulfill({json:{companyId:COMPANY,driverId:DRIVER,canManageAssignment:true,vehicles:[{id:VEHICLE,reg_plate:'TEST 123',type:'luton',status:'active',assigned_driver_id:assigned?DRIVER:null}],documents:[]}});
 });
 await page.goto('/visual-fixture/workspace-recovery/owner?screen=vehicle-readiness');await page.getByRole('button',{name:'Assign to me',exact:true}).click();
 await expect(page.getByText('One active vehicle is assigned to you.')).toBeVisible();expect(writes).toBe(1);
});
test('failed upload leaves form intact for retry',async({page})=>{
 await mockWorkspace(page,'driver');await page.route('**/api/driver/vehicle-readiness**',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:'Fixture storage unavailable'}}):route.fulfill({json:{companyId:COMPANY,driverId:DRIVER,canManageAssignment:false,vehicles:[{id:VEHICLE,reg_plate:'TEST 123',type:'luton',status:'active',assigned_driver_id:DRIVER}],documents:[]}}));
 await page.goto('/visual-fixture/workspace-recovery/driver?screen=vehicle-readiness&document=insurance');await page.getByLabel('Expiry date',{exact:true}).fill('2099-01-01');await page.locator('#vehicle-document-file').setInputFiles({name:'evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 fixture')});await page.getByRole('button',{name:'Submit vehicle document for verification'}).click();
 await expect(page.getByRole('alert').filter({hasText:'Fixture storage unavailable'})).toBeVisible();await expect(page.getByLabel('Expiry date',{exact:true})).toHaveValue('2099-01-01');await expect(page.getByRole('button',{name:'Submit vehicle document for verification'})).toBeEnabled();
});
