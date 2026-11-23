import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const {chromium}=createRequire('C:/Users/xdriv/.agents/dev-toolkit/package.json')('playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),process.env.PWA_SERVE_PUBLIC==='1'?'../../public/driver/reserve-pwa':'../dist');
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
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const pickup=new Date(Date.now()+86400000).toISOString();
const loads=[{id:'11111111-1111-4111-8111-111111111111',status:'posted',pickup_area:'Blackburn',pickup_postcode_area:'BB1',delivery_area:'Oldham',delivery_postcode_area:'OL1',pickup_datetime:pickup,delivery_datetime:pickup,requested_vehicle_label:'LWB Van',requested_vehicle_type:'lwb_van',vehicle_type:'lwb_van',cargo_type:'parcels',service_mode:'direct',payment_terms:'30 days',member:{name:'QA Broker',memberId:'QA01'},distance_miles:42,weight_kg:100}];
const resources={resources:{name:'QA Driver',email:'qa@example.test',phone:'',driver:{status:'active',driver_type:'owner_driver',availability_status:'available',future_position:'Leeds'},vehicle:{make:'Mercedes',model:'Sprinter',reg_plate:'QA-123',type:'LWB'},profile:{driver_id:'qa-driver',display_name:'QA Driver'},documents:[{id:'doc1',type:'MOT',is_vehicle_document:true}],alerts:[{id:'alert1',event_type:'load_awarded',created_at:'2026-11-20T10:00:00Z'}],return_journey:{from_postcode:'BB1',to_postcode:'LS1'},partial:[]}};
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const width of [390,420]){
    const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const errors=[],writes=[],sensitiveToken='qa-isolated-token';
    await ctx.addInitScript(token=>localStorage.setItem('xdrive-driver-reserve-live-session-v1',JSON.stringify({token,refreshToken:'qa-refresh',expiresAt:Date.now()+3600000})),sensitiveToken);
    await ctx.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==origin)return route.abort();
      if(request.method()!=='GET'&&request.method()!=='HEAD'){writes.push(request.method()+' '+url.pathname);return route.abort();}
      if(url.pathname.startsWith('/api/')){
        let body={};
        if(url.pathname.endsWith('/marketplace/loads'))body={loads};
        else if(url.pathname.endsWith('/profile'))body={driver:{driver_type:resources.resources.driver.driver_type}};
        else if(url.pathname.endsWith('/web/resources')){
          assert.equal(request.headers().authorization,'Bearer '+sensitiveToken,'Requires real token on More resources endpoint');
          body=resources;
        }
        else if(url.pathname.endsWith('/mobile/jobs'))body={jobs:[]};
        else if(url.pathname.endsWith('/mobile/bids'))body={bids:[]};
        else if(url.pathname.endsWith('/booking-offers'))body={offers:[]};
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
      }
      return route.continue();
    });
    const page=await ctx.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+base+'index.html');
    await page.getByRole('button',{name:'More',exact:true}).waitFor({timeout:20000});
    await page.getByRole('button',{name:'More',exact:true}).click();
    await page.getByRole('button',{name:/My Profile Personal details/}).waitFor();
    assert.equal(await page.locator('.xd-native-more-item').count(),10,'Owner Driver gets 9 operational cards plus My Invoices');
    assert.equal(await page.getByRole('button',{name:/My Vehicle Assigned vehicle/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/My Documents Driver and vehicle/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/Event Log Operational/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/Return Journeys Publish/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/Availability Manage/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/Who's Nearby/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/Directory Find/}).count(),1);
    assert.equal(await page.getByRole('button',{name:/Future Position Set/}).count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow in More');
    await page.getByRole('button',{name:/My Invoices/}).click();
    await page.getByRole('heading',{name:'Invoices',exact:true}).waitFor();
    await page.getByText('No invoices found for this account.').waitFor();
    await page.getByRole('button',{name:'← Bookings'}).click();
    await page.getByRole('button',{name:'More',exact:true}).click();
    await page.getByRole('button',{name:/My Profile Personal details/}).click();
    await page.getByText('qa@example.test').waitFor();
    await page.getByRole('button',{name:'← More'}).click();
    await page.getByRole('button',{name:/My Vehicle Assigned vehicle/}).click();
    await page.getByText('QA-123').waitFor();
    await page.getByRole('button',{name:'← More'}).click();
    await page.getByRole('button',{name:/My Documents Driver and vehicle/}).click();
    await page.getByText('MOT',{exact:true}).waitFor();
    await page.getByRole('button',{name:'← More'}).click();
    await page.getByRole('button',{name:/Event Log Operational/}).click();
    await page.getByText('load_awarded').waitFor();
    await page.getByRole('button',{name:'← More'}).click();
    await page.getByRole('button',{name:/Availability Manage/}).click();
    await page.getByText('available',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Loads',exact:true}).click();
    await page.getByText('QA Broker',{exact:true}).first().waitFor();
    await page.getByRole('button',{name:'Load Details',exact:true}).first().click();
    await page.getByRole('button',{name:'View on Map'}).click();
    await page.getByText('Route',{exact:true}).first().waitFor();
    const toolbar=page.locator('.xd-native-route__header');
    assert.equal(await toolbar.count(),1,'Original Route toolbar is present');
    assert.equal(await toolbar.evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(245, 163, 0)','Native original Route header orange');
    assert.equal(await page.locator('.xroute').count(),0,'Old Route interface must be fully removed');
    assert.equal(await page.locator('.xd-native-route__map').count(),1,'One map on replacement screen');
    assert.equal(await page.getByRole('button',{name:'Fit entire route'}).count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal scrolling in Route');
    await page.screenshot({path:'D:/XDrive-Guardian-Visual-QA/route-pwa-native-replacement-'+width+'.png'});
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByText('Collection & delivery').waitFor();
    assert.deepEqual(writes,[],'No writes or commercial actions are allowed in UI smoke test');
    assert.deepEqual(errors,[]);
    resources.resources.driver.driver_type='company_driver';
    await page.reload();
    await page.getByRole('button',{name:'More',exact:true}).waitFor();
    await page.getByRole('button',{name:'More',exact:true}).click();
    await page.getByRole('button',{name:/My Profile Personal details/}).waitFor();
    assert.equal(await page.getByRole('button',{name:/My Invoices/}).count(),0,'Company Driver must not see Owner Driver invoices');
    assert.equal(await page.locator('.xd-native-more-item').count(),9,'Company Driver retains the original 9 operational cards');
    resources.resources.driver.driver_type='owner_driver';
    console.log('ORIGINAL_ROUTE_MORE_PWA_PASS width='+width+' Owner 10 cards, Company Driver 9 cards, invoice navigation, 5 data views, Route/map/back, no writes or overflow');
    await ctx.close();
  }
}finally{await browser?.close();await new Promise(done=>server.close(done));}
