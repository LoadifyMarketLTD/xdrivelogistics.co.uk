import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const {chromium}=createRequire('C:/Users/xdriv/.agents/dev-toolkit/package.json')('playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const base='/driver/reserve-pwa/';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET'||!url.pathname.startsWith(base)){res.writeHead(404).end();return;}
  const name=decodeURIComponent(url.pathname.slice(base.length)||'index.html');
  const file=resolve(root,name);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(file))}
  catch{res.writeHead(404).end()}
});
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
const origin='http://127.0.0.1:'+server.address().port;
const pickup=new Date(Date.now()+86400000).toISOString();
const id='11111111-1111-4111-8111-111111111111';
const jobs=[{id,status:'posted',pickup_area:'Blackburn',pickup_postcode_area:'BB1',delivery_area:'Oldham',delivery_postcode_area:'OL1',pickup_datetime:pickup,delivery_datetime:pickup,requested_vehicle_label:'LWB Van',requested_vehicle_type:'lwb_van',vehicle_type:'lwb_van',cargo_type:'parcels',service_mode:'direct',payment_terms:'30 days',member:{name:'QA Quote Broker',memberId:'QA01'},distance_miles:42,weight_kg:100,public_quote_notes:'Contact collection office before arrival'}];
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const width of (process.env.XD_QA_WIDTH ? [Number(process.env.XD_QA_WIDTH)] : [390,420])){
    const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const errors=[],mutations=[];
    await ctx.addInitScript(()=>localStorage.setItem('xdrive-driver-reserve-live-session-v1',JSON.stringify({token:'qa-isolated-token',refreshToken:'qa-refresh',expiresAt:Date.now()+3600000})));
    await ctx.route('**/*',async route=>{
      const req=route.request();const url=new URL(req.url());
      if(url.origin!==origin)return route.abort();
      if(req.method()!=='GET'&&req.method()!=='HEAD'){mutations.push(req.method()+' '+url.pathname);return route.abort();}
      if(url.pathname.startsWith('/api/')){
        let body={};
        if(url.pathname.endsWith('/marketplace/loads'))body={loads:jobs};
        else if(url.pathname.endsWith('/profile'))body={driver:{driver_type:'owner_driver'}};
        else if(url.pathname.endsWith('/mobile/jobs'))body={jobs:[]};
        else if(url.pathname.endsWith('/mobile/bids'))body={bids:[]};
        else if(url.pathname.endsWith('/booking-offers'))body={offers:[]};
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
      }
      return route.continue();
    });
    const page=await ctx.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+base+'index.html');
    await page.getByText('QA Quote Broker',{exact:true}).first().waitFor({timeout:20000});
    await page.getByRole('button',{name:'Load Details',exact:true}).first().click();
    await page.getByText('Collection & delivery',{exact:true}).waitFor();
    await page.getByText('Load requirements',{exact:true}).waitFor();
    await page.getByText('Customer & payment',{exact:true}).waitFor();
    await page.getByText('Full load instructions',{exact:true}).waitFor();
    assert.equal(await page.getByText('Contact collection office before arrival').count()>0,true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow in Load Details');
    await page.getByRole('button',{name:/Enter your quote/}).click();
    await page.getByRole('heading',{name:'Quote Now'}).waitFor();
    await page.getByLabel('Will pick up within').selectOption('15');
    await page.getByLabel('Your quote total including VAT where applicable').fill('120.00');
    await page.getByRole('button',{name:'+ Add extra'}).click();
    await page.getByLabel('Extra description').fill('Tail lift');
    await page.getByLabel('Extra amount GBP').fill('15.50');
    await page.getByText('£135.50',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Will pick up within').inputValue(),'15');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow in Quote Now');
    assert.equal(await page.getByRole('button',{name:/Submit Quote/}).isEnabled(),true);
    await page.getByLabel('Extra amount GBP').fill('-5');
    await page.getByRole('button',{name:/Submit Quote/}).click();
    await page.getByText('Complete each extra description and its non-negative amount.').waitFor();
    // Invalid input must not call any network mutation or submit a commercial quote.
    assert.deepEqual(mutations,[]);
    assert.deepEqual(errors,[]);
    console.log('LOAD_DETAILS_QUOTE_036_PASS viewport='+width+' route+instructions+extras+invalid-extra-blocked; no live writes');
    await ctx.close();
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
