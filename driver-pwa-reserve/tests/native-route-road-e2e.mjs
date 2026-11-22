import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/xdriv/.agents/dev-toolkit/package.json')('playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const base='/driver/reserve-pwa/';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET'||!url.pathname.startsWith(base)){res.writeHead(404).end();return;}
  const name=decodeURIComponent(url.pathname.slice(base.length)||'index.html');
  const file=resolve(root,name);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(await readFile(file))}
  catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const pickup=new Date(Date.now()+86400000).toISOString();
const loads=[{id:'11111111-1111-4111-8111-111111111111',status:'posted',pickup_area:'Blackburn',pickup_postcode_area:'BB1',delivery_area:'Oldham',delivery_postcode_area:'OL1',pickup_datetime:pickup,delivery_datetime:pickup,requested_vehicle_type:'lwb_van',vehicle_type:'lwb_van',cargo_type:'parcels',service_mode:'direct',payment_terms:'30 days',member:{name:'QA Broker',memberId:'QA01'},distance_miles:45,weight_kg:100}];
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',
    permissions:['geolocation'],geolocation:{latitude:53.748,longitude:-2.482}});
  const mutations=[],errors=[],routeRequests=[];
  await ctx.addInitScript(()=>localStorage.setItem('xdrive-driver-reserve-live-session-v1',JSON.stringify({token:'qa-route-token',refreshToken:'qa-route-refresh',expiresAt:Date.now()+3600000})));
  await ctx.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(req.method()!=='GET'){mutations.push(req.method()+' '+u.pathname);return route.abort();}
    if(u.origin!==origin)return route.abort();
    if(u.pathname.startsWith('/api/')){
      let response={};
      if(u.pathname.endsWith('/marketplace/loads'))response={loads};
      else if(u.pathname.endsWith('/profile'))response={driver:{driver_type:'owner_driver'}};
      else if(u.pathname.endsWith('/mobile/jobs'))response={jobs:[]};
      else if(u.pathname.endsWith('/mobile/bids'))response={bids:[]};
      else if(u.pathname.endsWith('/booking-offers'))response={offers:[]};
      else if(u.pathname.endsWith('/web/public-outcode')){
        const outcode=u.searchParams.get('outcode');
        response=outcode==='BB1'?{latitude:53.750,longitude:-2.480}:{latitude:53.542,longitude:-2.110};
      }else if(u.pathname.endsWith('/web/public-route')){
        assert.equal(req.headers().authorization,'Bearer qa-route-token');
        const a=[Number(u.searchParams.get('aLng')),Number(u.searchParams.get('aLat'))];
        const b=[Number(u.searchParams.get('bLng')),Number(u.searchParams.get('bLat'))];
        routeRequests.push([a,b]);
        response={geometry:{type:'LineString',coordinates:[a,b]},distanceMiles:12.4,durationMinutes:25};
      }
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
    }
    return route.continue();
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+base+'index.html');
  await page.getByRole('button',{name:'Load Details',exact:true}).first().click();
  await page.getByRole('button',{name:'View on Map'}).click();
  await page.locator('.xd-native-route__header').waitFor();
  await page.locator('.route-marker span').first().waitFor({timeout:16000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.route-marker span')].some(e=>e.textContent==='V')&&
    [...document.querySelectorAll('.route-marker span')].some(e=>e.textContent==='1')&&
    [...document.querySelectorAll('.route-marker span')].some(e=>e.textContent==='2'),{timeout:16000});
  await page.getByText('12.4 mi | 25 min').first().waitFor({timeout:16000});
  assert.equal(routeRequests.length>=2,true,'Road routes were requested from authenticated backend');
  assert.equal(await page.locator('.xd-native-route__map .leaflet-interactive').count()>=2,true,'Both legs are drawn');
  assert.deepEqual(errors,[]);
  assert.deepEqual(mutations,[]);
  await page.screenshot({path:'D:/XDrive-Guardian-Visual-QA/route-pwa-native-road-qa.png'});
  console.log('NATIVE_ROUTE_ROAD_PASS: markers V/1/2, two road legs, GPS, real API request shape, no writes');
  await ctx.close();
}finally{await browser?.close();await new Promise(done=>server.close(done));}
