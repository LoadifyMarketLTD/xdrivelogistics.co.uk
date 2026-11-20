import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/xdriv/.agents/dev-toolkit/package.json')('playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const origin='https://www.xdrivelogistics.co.uk',base='/driver/reserve-pwa/';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const id='11111111-1111-4111-8111-111111111111';
const row=name=>({id,status:'posted',pickup_area:'Blackburn',pickup_postcode_area:'BB1',delivery_area:'Leeds',delivery_postcode_area:'LS1',requested_vehicle_label:'LWB Van',member:{name},payment_terms:'30 days'});
const b=await chromium.launch({channel:'msedge',headless:true});
try{
const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
let mode='initial',calls=0,historyDone=false,marketplaceSettled=false,secondaryStartedBeforeMarket=false;const errors=[],writes=[];
await c.addInitScript(()=>localStorage.setItem('xdrive-driver-reserve-live-session-v1',JSON.stringify({token:'fixture',refreshToken:'fixture',expiresAt:Date.now()+3600000})));
await c.route('**/*',async r=>{
 const req=r.request(),u=new URL(req.url());if(u.origin!==origin)return r.abort();
 if(req.method()!=='GET'){writes.push(req.method());return r.abort();}
 const json=(data,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(u.pathname.startsWith('/api/')){
 if(u.pathname.endsWith('/profile'))return json({driver:{driver_type:'owner_driver'}});
 if(u.pathname.endsWith('/marketplace/loads')){calls++;if(mode==='initial'){await new Promise(r=>setTimeout(r,700));marketplaceSettled=true;}if(mode==='denied')return json({error:'Unauthorized'},401);if(mode==='failed')return json({error:'Service unavailable'},503);return json({loads:mode==='removed'?[]:[row(mode==='initial'?'QA Initial Carrier':'QA Updated Carrier')]});}
 if(u.pathname.endsWith('/mobile/jobs')){if(!marketplaceSettled)secondaryStartedBeforeMarket=true;if(u.searchParams.get('scope')==='completed'&&mode==='initial'){await new Promise(r=>setTimeout(r,4500));historyDone=true;}return json({jobs:[]});}
 if(u.pathname.endsWith('/mobile/bids')){if(!marketplaceSettled)secondaryStartedBeforeMarket=true;return json({bids:[]});}
 if(u.pathname.endsWith('/booking-offers')){if(!marketplaceSettled)secondaryStartedBeforeMarket=true;return json({offers:[]});}
 return json({});
 }
 if(!u.pathname.startsWith(base))return r.abort();const f=resolve(root,decodeURIComponent(u.pathname.slice(base.length)||'index.html'));if(!f.startsWith(root+sep))return r.abort();try{return r.fulfill({status:200,contentType:mime[extname(f)]||'application/octet-stream',body:await readFile(f)})}catch{return r.fulfill({status:404,body:''})}
});
const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
await p.goto(origin+base+'index.html');await p.getByText('Loading loads',{exact:true}).waitFor();assert.equal(await p.locator('.rv-feed-spinner').count(),1);assert.equal(await p.getByText(/Refreshing live jobs|Loading live data|Refreshing XDrive/).count(),0);await p.getByText('QA Initial Carrier',{exact:true}).first().waitFor({timeout:10000});assert.equal(historyDone,false);assert.equal(secondaryStartedBeforeMarket,false);assert.equal(await p.locator('.rv-feed-spinner').count(),0);console.log('PASS single loading indicator and marketplace before slow history');
await p.waitForFunction(()=>!document.body.innerText.includes('Refreshing live jobs'));await new Promise(r=>setTimeout(r,4800));
const resume=async()=>{const prev=calls;await p.evaluate(()=>window.dispatchEvent(new Event('online')));await p.waitForFunction(()=>true);for(let i=0;i<100&&calls===prev;i++)await new Promise(r=>setTimeout(r,100));assert.ok(calls>prev,'online recovery did not request marketplace');};
mode='updated';await resume();await p.getByText('QA Updated Carrier',{exact:true}).first().waitFor();assert.equal(await p.getByText('QA Initial Carrier',{exact:true}).count(),0);console.log('PASS updated row replaces old row');
await p.waitForTimeout(500);mode='removed';await resume();await p.getByText('QA Updated Carrier',{exact:true}).first().waitFor({state:'hidden'});console.log('PASS withdrawn row removed');
await p.waitForTimeout(500);mode='failed';await resume();await p.getByText('Some sources are temporarily unavailable',{exact:true}).waitFor();console.log('PASS failure not false empty');
await p.waitForTimeout(500);mode='updated';await resume();await p.getByText('QA Updated Carrier',{exact:true}).first().waitFor();console.log('PASS reconnect restores data');
await p.waitForTimeout(500);mode='denied';await resume();await p.getByText('QA Updated Carrier',{exact:true}).first().waitFor({state:'hidden'});await p.waitForFunction(()=>localStorage.getItem('xdrive-driver-reserve-live-session-v1')===null);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS revoked session clears data; no writes or JS errors');
}finally{await b.close()}

