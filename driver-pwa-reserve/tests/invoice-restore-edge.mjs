import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/xdriv/.agents/dev-toolkit/package.json')('playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const evidence=resolve(root,'../../OPPO_QA_EVIDENCE');await mkdir(evidence,{recursive:true});
const origin='https://www.xdrivelogistics.co.uk',base='/driver/reserve-pwa/';
const id='22222222-3333-4444-8555-666666666666', invId='11111111-2222-4333-8444-555555555555';
const assigned={id,currentStatus:'delivered',podGenerated:true,deliverySignatureData:'fixture',clientSignatureName:'QA recipient',companyName:'Fixture Carrier Customer',pickupLocation:'Blackburn QA',deliveryLocation:'Leeds QA',reference:'XDL-22222222',paymentTerms:'14 days',agreedRateAmount:125};
const eligible={id,commercial_mode:'marketplace',agreed_amount:125,agreed_vat_amount:0,agreed_vat_rate:0,agreed_gross_amount:125,payment_terms:'14 days',payment_due_days:14,currency:'GBP'};
const blockedId='33333333-4444-4555-8666-777777777777';
const blocked={...assigned,id:blockedId,reference:'XDL-33333333',podArchived:true,podEvidenceComplete:false,deliverySignatureData:{type:'recipient_typed_name_attestation'},agreedRateAmount:10,paymentTerms:'30 days',currentStatus:'completed'};
const blockedContext={...eligible,id:blockedId,agreed_amount:10,agreed_gross_amount:10,payment_terms:'30 days',payment_due_days:30,can_create_invoice:false,blocker:'DRAWN_SIGNATURE_REQUIRED'};
const original={id:invId,job_id:id,invoice_number:'QA-INV-01',status:'Draft',client_name:'Fixture Carrier Customer',client_email:'qa@example.invalid',client_address:'Fixture address',net_amount:125,vat_amount:0,vat_rate:0,amount:125,currency:'GBP',payment_terms:'14 days',invoice_date:'2026-11-19',due_date:'2026-12-03',job_ref:'XDL-22222222',invoice_origin:'marketplace',delivery_state:'idle',service_description:JSON.stringify({schema:'xdrive_load_details_v2',source:'customer_workspace_v3_edit',targetCarrierCost:null,additionalStopCount:1})};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const b=await chromium.launch({channel:'msedge',headless:true});
try{for(const width of [390,420]){
 const c=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',acceptDownloads:true});let invoice=null,generated=0,patched=0,sent=0;const errors=[];
 await c.addInitScript(()=>localStorage.setItem('xdrive-driver-reserve-live-session-v1',JSON.stringify({token:'fixture-only',refreshToken:'fixture-only',expiresAt:Date.now()+3600000})));
 await c.route('**/*',async r=>{const req=r.request(),u=new URL(req.url()),verb=req.method();if(u.origin!==origin)return r.abort();const json=(data,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(u.pathname.startsWith('/api/')){
 if(u.pathname.endsWith('/profile'))return json({driver:{driver_type:'owner_driver'}});
 if(u.pathname.endsWith('/marketplace/loads'))return json({loads:[]});
 if(u.pathname.endsWith('/mobile/jobs'))return json({jobs:u.searchParams.get('scope')==='completed'?[{...assigned,podArchived:true,podEvidenceComplete:true},blocked]:[]});
 if(u.pathname.endsWith('/mobile/bids'))return json({bids:[]});
 if(u.pathname.endsWith('/booking-offers'))return json({offers:[]});
 if(u.pathname.endsWith('/mobile/jobs/'+id))return json({job:assigned});
 if(u.pathname.endsWith('/eligible'))return json({contexts:[{...eligible,invoice,can_create_invoice:!invoice},blockedContext],rows:[eligible]});
 if(u.pathname.endsWith('/invoice-context'))return u.pathname.includes(blockedId)?json({rows:[],context:blockedContext,blocker:blockedContext.blocker}):json({rows:[{...eligible,invoice}],context:{...eligible,invoice,can_create_invoice:!invoice}});
 if(u.pathname.endsWith('/generate-invoice')&&verb==='POST'){const data=req.postDataJSON();assert.ok(data.idempotency_key);assert.equal(data.amount,undefined);generated++;invoice={...original};return json({invoice});}
 if(u.pathname.endsWith('/finance/invoices/'+invId))return json({invoice});
 if(u.pathname.endsWith('/draft')&&verb==='PATCH'){const data=req.postDataJSON();assert.equal(data.net_amount,undefined);assert.equal(data.client_email,original.client_email);patched++;invoice={...invoice,service_description:data.service_description};return json({invoice});}
 if(u.pathname.endsWith('/preview'))return r.fulfill({status:200,contentType:'application/pdf',body:'%PDF-1.4\n'+ '0'.repeat(1500)});
 if(u.pathname.endsWith('/submit')){sent++;return json({error:'Test may not send'},403);}
 return json({});
 }
 if(verb!=='GET'||!u.pathname.startsWith(base))return r.abort();const f=resolve(root,decodeURIComponent(u.pathname.slice(base.length)||'index.html'));if(!f.startsWith(root+sep))return r.abort();try{return r.fulfill({status:200,contentType:mime[extname(f)]||'application/octet-stream',body:await readFile(f)})}catch{return r.fulfill({status:404,body:''})}
 });
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+base+'index.html?live=1');await p.getByRole('button',{name:'Bookings',exact:true}).click();await p.getByRole('button',{name:'History',exact:true}).click();await p.getByText('Ref: XDL-22222222',{exact:true}).waitFor({timeout:20000});
 const blockedCard=p.locator('article').filter({has:p.getByText('Ref: XDL-33333333',{exact:true})});await blockedCard.getByRole('button',{name:'Review Invoice Eligibility',exact:true}).click();await p.getByText('Signature requires review',{exact:true}).waitFor();assert.equal(await p.getByLabel('Unit price (GBP)').inputValue(),'10');assert.equal(await p.getByLabel('Payment terms').inputValue(),'30 days');assert.equal(await p.getByLabel('VAT rate').inputValue(),'0');assert.equal(await p.getByRole('button',{name:'Create',exact:true}).isDisabled(),true);assert.equal(generated,0);assert.equal(await p.locator('main').getByText('£10.00',{exact:true}).count(),2);await p.screenshot({path:resolve(evidence,'invoice-blocked-contract-preserved-'+width+'.png'),fullPage:true});await p.getByRole('button',{name:'Bookings',exact:true}).click();await p.getByRole('button',{name:'History',exact:true}).click();const readyCard=p.locator('article').filter({has:p.getByText('Ref: XDL-22222222',{exact:true})});await readyCard.getByRole('button',{name:'Create Invoice',exact:true}).click();assert.equal(await readyCard.count(),0);
 await p.getByRole('heading',{name:'Create Invoice',exact:true}).waitFor();await p.getByRole('button',{name:'Create',exact:true}).waitFor();await p.getByRole('button',{name:'Create',exact:true}).waitFor({state:'visible'});await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Create'&&!b.disabled));
 assert.equal(await p.getByLabel('Unit price (GBP)').inputValue(),'125');assert.equal(await p.getByLabel('Unit price (GBP)').getAttribute('readonly'),'');assert.equal(await p.getByLabel('VAT rate').inputValue(),'0');assert.equal(await p.getByLabel('Payment terms').inputValue(),'14 days');assert.equal(await p.getByRole('button',{name:'+ Add item',exact:true}).isDisabled(),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.screenshot({path:resolve(evidence,'invoice-create-restored-'+width+'.png'),fullPage:true});
 await p.getByRole('button',{name:'Create',exact:true}).click();await p.getByRole('heading',{name:'View Invoice',exact:true}).waitFor({timeout:10000});assert.equal(generated,1);await p.getByText('Invoice no: QA-INV-01',{exact:true}).waitFor();await p.getByText('Transport service',{exact:true}).waitFor();assert.equal(await p.getByText(/xdrive_load_details_v2|customer_workspace_v3_edit/).count(),0);await p.screenshot({path:resolve(evidence,'invoice-view-restored-'+width+'.png'),fullPage:true});
 await p.getByRole('button',{name:'Edit invoice',exact:true}).click();await p.getByRole('heading',{name:'Edit Invoice',exact:true}).waitFor();await p.locator('label.rv-field').filter({has:p.getByText('Notes',{exact:true})}).locator('textarea').fill('QA updated notes',{timeout:8000});await p.getByRole('button',{name:'Save changes',exact:true}).click();await p.getByRole('heading',{name:'View Invoice',exact:true}).waitFor();assert.equal(patched,1);
 await p.getByRole('button',{name:'Email',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Send Invoice via XDrive'}).isDisabled(),true);const download=p.waitForEvent('download');await p.getByRole('button',{name:'Download',exact:true}).click();await download;assert.equal(await p.getByRole('button',{name:'Send Invoice via XDrive'}).isDisabled(),true);assert.equal(sent,0);await p.getByRole('button',{name:'Bookings',exact:true}).click();await p.getByRole('button',{name:'History',exact:true}).click();await p.locator('article').filter({has:p.getByText('Ref: XDL-22222222',{exact:true})}).getByRole('button',{name:'View Invoice',exact:true}).waitFor({timeout:15000});assert.equal(await p.getByRole('button',{name:/View Signed POD/}).count(),0);assert.deepEqual(errors,[]);console.log('PASS',width,'create, official record, locked contract, draft edit, download, email approval, no sends, no JS errors');await c.close();
}}finally{await b.close()}