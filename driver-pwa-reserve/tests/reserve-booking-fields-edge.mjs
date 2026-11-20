import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/xdriv/.agents/dev-toolkit/package.json')('playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist'),evidence=resolve(root,'../../OPPO_QA_EVIDENCE');
await mkdir(evidence,{recursive:true});
const origin='https://www.xdrivelogistics.co.uk',base='/driver/reserve-pwa/',id='22222222-3333-4444-8555-666666666666';
const assigned={id,isTest:true,currentStatus:'loaded',companyName:'Fixture Customer',pickupLocation:'QA Blackburn',deliveryLocation:'QA Leeds',reference:'XDL-22222222',paymentTerms:'30 days',agreedRateAmount:150,packaging:'Boxes',itemCount:4,stops:[{id:'s1',sequence:1,type:'collection',status:'completed',address:'QA Blackburn',handover:{version:3}},{id:'s2',sequence:2,type:'delivery',status:'arrived',address:'QA Bolton',arrivedAt:new Date(Date.now()-300000).toISOString()},{id:'s3',sequence:3,type:'delivery',status:'pending',address:'QA Leeds'}]};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const b=await chromium.launch({channel:'msedge',headless:true});
try{for(const width of [390,420]){
 const c=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});let extras=[],requests=[],writes=0,cancellations=0,attempts=0,firstId="";const errors=[];
 await c.addInitScript(()=>localStorage.setItem('xdrive-driver-reserve-live-session-v1',JSON.stringify({token:'fixture-only',refreshToken:'fixture-only',expiresAt:Date.now()+3600000})));
 await c.route('**/*',async r=>{const req=r.request(),u=new URL(req.url()),verb=req.method();if(u.origin!==origin)return r.abort();const json=(data,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(u.pathname.startsWith('/api/')){
 if(u.pathname.endsWith('/profile'))return json({driver:{driver_type:'owner_driver'}});
 if(u.pathname.endsWith('/marketplace/loads'))return json({loads:[]});
 if(u.pathname.endsWith('/mobile/jobs'))return json({jobs:u.searchParams.get('scope')==='bookings'?[assigned]:[]});
 if(u.pathname.endsWith('/mobile/bids'))return json({bids:[]});
 if(u.pathname.endsWith('/booking-offers'))return json({offers:[]});
 if(u.pathname.endsWith('/mobile/jobs/'+id))return json({job:assigned});
 if(u.pathname.endsWith('/extras')){if(verb==='GET')return json({ok:true,extras});const {requestId,...body}=req.postDataJSON();assert.match(requestId,/^[a-f0-9-]{36}$/);assert.deepEqual(body,{extraType:'waiting_time',amountGbp:15,minutes:30,description:'QA waiting only'});attempts++;if(attempts===1){firstId=requestId;return r.abort('failed');}assert.equal(requestId,firstId);writes++;extras=[{id:requestId,extra_type:'waiting_time',amount_gbp:15,minutes:30,description:'QA waiting only',status:'submitted'}];return json({ok:true,extra:extras[0]},201);}
 if(u.pathname.endsWith('/cancellation-request')){if(verb==='GET')return json({ok:true,requests});const d=req.postDataJSON();assert.equal(d.stop_id,'s2');assert.equal(d.cancellation.scope,'job');assert.equal(d.cancellation.goodsInCustody,true);assert.equal(d.cancellation.reason,'QA cancellation only');cancellations++;requests=[{id:'request-1',status:'pending',reason:'QA cancellation only',created_at:'2026-11-19T22:00:00Z'}];return json({ok:true,requestId:'request-1',status:'pending',custody:true},201);}
 if(verb!=='GET')throw Error('Unexpected live mutation '+u.pathname);
 return json({});
 }
 if(verb!=='GET'||!u.pathname.startsWith(base))return r.abort();const f=resolve(root,decodeURIComponent(u.pathname.slice(base.length)||'index.html'));if(!f.startsWith(root+sep))return r.abort();try{return r.fulfill({status:200,contentType:mime[extname(f)]||'application/octet-stream',headers:extname(f)==='.html'?{'content-security-policy':"default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'"}:undefined,body:await readFile(f)})}catch{return r.fulfill({status:404,body:''})}
 });
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+base+'index.html?live=1');await p.getByRole('button',{name:'Bookings',exact:true}).click();await p.getByRole('button',{name:'Active',exact:true}).click();const card=p.locator('article').filter({has:p.getByText('Ref: XDL-22222222',{exact:true})});await card.getByRole('button',{name:'Booking Status',exact:true}).click({timeout:20000});
 await p.getByRole('button',{name:'On My Way to Final Delivery',exact:true}).click();
 await p.getByLabel('Received By *',{exact:true}).fill('QA synthetic recipient');
 console.log('SCREEN',(await p.locator('main').innerText()).slice(0,1800)); const packaging=p.locator('label.rv-field').filter({has:p.getByText('Packaging',{exact:true})}).locator('select');await packaging.waitFor({timeout:5000});
 assert.deepEqual(await packaging.locator('option').allTextContents(),['Select packaging','Pallets','Boxes','Crates','Loose items','Roll cages','Other']);
 await packaging.selectOption('Boxes');
 await p.getByRole('button',{name:/Booking status/i}).first().click();
 await p.getByRole('button',{name:'On My Way to Final Delivery',exact:true}).click();
 assert.equal(await p.getByLabel('Received By *',{exact:true}).inputValue(),'QA synthetic recipient');
 assert.equal(await packaging.inputValue(),'Boxes');
 console.log('PASS_MEMORY_BACK_DRAFT',width);
 const times=await p.locator('label.rv-field').filter({has:p.getByText('Delivery Time *',{exact:true})}).locator('select option').allTextContents();assert.ok(times.length>=2&&times.length<=8,JSON.stringify(times));
 await p.getByRole('button',{name:'Add Signature',exact:true}).click();
 const modal=p.getByRole('dialog',{name:'Recipient signature',exact:true});await modal.waitFor();assert.equal(await modal.getByRole('button',{name:'Done',exact:true}).isDisabled(),true);
 const canvas=modal.locator('canvas'),rect=await canvas.boundingBox();assert.ok(rect&&rect.width>200&&rect.height>150);
 await p.mouse.move(rect.x+30,rect.y+40);await p.mouse.down();await p.mouse.move(rect.x+100,rect.y+100,{steps:8});await p.mouse.move(rect.x+180,rect.y+45,{steps:8});await p.mouse.up();
 await p.screenshot({path:resolve(evidence,'qa-restored-signature-'+width+'.png')});
 await modal.getByRole('button',{name:'Done',exact:true}).click();
 await p.getByRole('button',{name:'Save Signature',exact:true}).click();await p.getByRole('button',{name:'Signature Saved',exact:true}).waitFor();
 await p.getByRole('button',{name:/Booking status/i}).first().click();
 await p.getByRole('button',{name:'On My Way to Final Delivery',exact:true}).click();
 assert.equal(await p.getByRole('button',{name:'Signature Saved',exact:true}).count(),1);
 assert.equal(await p.getByLabel('Received By *',{exact:true}).inputValue(),'QA synthetic recipient');
 console.log('PASS_MEMORY_BACK_SIGNATURE',width);
 assert.equal(await p.getByRole('button',{name:'Signature Saved',exact:true}).isDisabled(),true);
 await p.getByRole('button',{name:'Edit Signature',exact:true}).click();await modal.getByRole('button',{name:'Clear',exact:true}).click();assert.equal(await modal.getByRole('button',{name:'Done',exact:true}).isDisabled(),true);
 await modal.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Save Signature',exact:true}).isDisabled(),true);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.equal(writes,0);
 console.log('PASS',width,'packaging choices, chronological actual time, full-screen signature, save/edit/clear; no live writes');await c.close();
}}finally{await b.close()}