import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const {chromium}=createRequire('C:/Users/xdriv/.agents/dev-toolkit/package.json')('playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist'),base='/driver/reserve-pwa/';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(req.method!=='GET'||!pathname.startsWith(base)){res.writeHead(404).end();return;}
  const file=resolve(root,decodeURIComponent(pathname.slice(base.length)||'index.html'));
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(await readFile(file))}
  catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const id='22222222-3333-4444-8555-666666666666';
const gpsTrail=[
 {lat:53.748,lng:-2.482,recorded_at:'2026-11-22T10:00:00Z'},
 {lat:53.749,lng:-2.48,recorded_at:'2026-11-22T10:05:00Z'},
 {lat:53.75,lng:-2.478,recorded_at:'2026-11-22T10:10:00Z'}
];
const bookingData={job_id:id,pickup:{lat:53.75,lon:-2.48},delivery:{lat:53.48,lon:-2.24},gps_trail:gpsTrail,gps_history_kind:'sampled_recorded_positions',sample_limit:750,truncated:false};
const baseJob={id,isTest:true,companyName:'QA Booking Broker',pickupLocation:'QA private road, Blackburn, BB1',deliveryLocation:'QA private road, Manchester, M1',
 reference:'XDL-22222222',paymentTerms:'30 days',agreedRateAmount:150,
 stops:[{id:'s1',sequence:1,type:'collection',status:'pending',address:'QA private road, Blackburn, BB1'},
        {id:'s2',sequence:2,type:'delivery',status:'pending',address:'QA private road, Manchester, M1'}]};
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const scenario of ['before_collection','after_collection']){
  const loaded=scenario==='after_collection';
  const job={...baseJob,currentStatus:loaded?'loaded':'on_my_way',stops:baseJob.stops.map((s,i)=>({...s,status:loaded&&i===0?'completed':'pending',completedAt:loaded&&i===0?'2026-11-22T10:10:00Z':undefined}))};
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',
    permissions:['geolocation'],geolocation:{latitude:53.748,longitude:-2.482}});
  await context.addInitScript(()=>localStorage.setItem('xdrive-driver-reserve-live-session-v1',JSON.stringify({token:'qa-booking-history',refreshToken:'qa-refresh',expiresAt:Date.now()+3600000})));
  const errors=[],mutations=[],apiCalls=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()!=='GET'){mutations.push(url.pathname);return route.abort();}
   if(url.origin!==origin)return route.abort();
   if(url.pathname.startsWith('/api/')){
    let payload={};apiCalls.push(url.pathname);
    if(url.pathname.endsWith('/profile'))payload={driver:{driver_type:'owner_driver'}};
    else if(url.pathname.endsWith('/marketplace/loads'))payload={loads:[]};
    else if(url.pathname.endsWith('/mobile/jobs'))payload={jobs:url.searchParams.get('scope')==='bookings'?[job]:[]};
    else if(url.pathname.endsWith('/mobile/jobs/'+id))payload={job};
    else if(url.pathname.endsWith('/booking-offers'))payload={offers:[]};
    else if(url.pathname.endsWith('/mobile/bids'))payload={bids:[]};
    else if(url.pathname.endsWith('/web/booking-route')){
      assert.equal(request.headers().authorization,'Bearer qa-booking-history','GPS trail requires driver authorization');
      assert.equal(url.searchParams.get('jobId'),id,'GPS trail is constrained to selected booking');
      payload=bookingData;
    }else if(url.pathname.endsWith('/web/public-route')){
      assert.equal(request.headers().authorization,'Bearer qa-booking-history');
      const a=[Number(url.searchParams.get('aLng')),Number(url.searchParams.get('aLat'))];
      const b=[Number(url.searchParams.get('bLng')),Number(url.searchParams.get('bLat'))];
      payload={geometry:{type:'LineString',coordinates:[a,b]},distanceMiles:12.4,durationMinutes:25};
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
   }
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+base+'index.html');
  await page.getByRole('button',{name:'Bookings',exact:true}).click();
  await page.getByRole('button',{name:'Active',exact:true}).click();
  const card=page.locator('article').filter({hasText:'QA Booking Broker'}).first();
  await card.waitFor({timeout:18000});
  await card.getByRole('button',{name:'View Booking Details'}).click();
  await page.getByRole('button',{name:'View on Map'}).click();
  await page.locator('.xd-native-route__header').waitFor();
  await page.getByText('Recorded GPS trail: 3 sampled positions',{exact:false}).waitFor({timeout:16000});
  await page.waitForFunction(()=>document.querySelectorAll('.xd-native-route__map .leaflet-interactive').length>=3,null,{timeout:16000});
  const markerLabels=await page.locator('.route-marker span').allTextContents();
  assert.equal(markerLabels.includes('1')&&markerLabels.includes('2'),true,'Original collection and delivery markers remain visible in both phases');
  const polylines=await page.locator('.xd-native-route__map path.leaflet-interactive').evaluateAll(nodes=>
    nodes.map(node=>({stroke:node.getAttribute('stroke'),dash:node.getAttribute('stroke-dasharray')})));
  assert.equal(polylines.some(p=>p.stroke==='#7c3aed'),true,'Recorded trail present as purple sample polyline');
  assert.equal(polylines.filter(p=>['#7c3aed','#ef5350','#2196f3'].includes(p.stroke)).at(-1)?.stroke,'#7c3aed','Recorded GPS path must render above overlapping planned roads');
  assert.equal(polylines.some(p=>p.stroke==='#ef5350'),true,'Collection-to-delivery road route remains red');
  if(!loaded)assert.equal(polylines.some(p=>p.stroke==='#2196f3'),true,'Driver-to-pickup road route is blue before loading');
  if(loaded)assert.equal(polylines.some(p=>p.stroke==='#2196f3'),true,'Driver-to-delivery road route is blue after loading');
  assert.equal(await page.getByText('12.4 mi | 25 min').count()>=1,true,'Road miles shown');
  assert.equal(apiCalls.includes('/api/driver/web/booking-route'),true);
  assert.equal(await page.locator('.xroute').count(),0,'Old Route UI not mixed with new');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'D:/XDrive-Guardian-Visual-QA/booking-route-gps-history-'+scenario+'.png',animations:'disabled'});
  assert.deepEqual(mutations,[]);
  assert.deepEqual(errors,[]);
  console.log('BOOKINGS_ROUTE_HISTORY_PASS '+scenario+' tracked samples + both road legs + GPS position; no writes');
  await context.close();
 }
}finally{await browser?.close();await new Promise(resolveClose=>server.close(resolveClose));}
