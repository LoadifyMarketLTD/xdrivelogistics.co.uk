import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const file=resolve(dirname(fileURLToPath(import.meta.url)),'../../app/api/driver/web/booking-route/route.ts');
const source=await readFile(file,'utf8');
// Node's native TS stripper tests the actual route body, without starting a live server.
const js=stripTypeScriptTypes(source,{mode:'strip'})
  .replace(/^import .*?;\s*$/gm,'')
  .replace(/^export const /gm,'const ')
  .replace(/^export async function GET/gm,'async function GET')+'\nexports.GET=GET;';

const BOOKING_ID='22222222-3333-4444-8555-666666666666';
const OWN_DRIVER='driver-owner',OWN_COMPANY='company-owner';
const AUTH={driverId:OWN_DRIVER,companyId:OWN_COMPANY};
const request={url:'https://xdrive.example/api/driver/web/booking-route?jobId='+BOOKING_ID};
const dbJob={id:BOOKING_ID,assigned_driver_id:OWN_DRIVER,assigned_company_id:OWN_COMPANY,
 awarded_carrier_company_id:OWN_COMPANY,pickup_lat:53.75,pickup_lng:-2.48,delivery_lat:53.48,delivery_lng:-2.24};
const gps=[
 {lat:53.8,lng:-2.5,recorded_at:'2026-11-22T11:00:00Z'},
 {lat:53.74,lng:-2.48,recorded_at:'2026-11-22T10:00:00Z'},
 {lat:53.74,lng:-2.48,recorded_at:'2026-11-22T10:01:00Z'},
 {lat:0,lng:0,recorded_at:'2026-11-22T10:02:00Z'},
 {lat:53.75,lng:-2.47,recorded_at:'2026-11-22T10:10:00Z'},
];

async function perform({driver=AUTH,job=dbJob,locations=gps,url=request.url,dbError=false}={}){
 const calls=[];
 const admin={from(table){
   const filters={};
   return {
    select(columns){calls.push({kind:'select',table,columns});return this;},
    eq(key,value){filters[key]=value;calls.push({kind:'eq',table,key,value});return this;},
    maybeSingle:async()=>({data:dbError?null:job,error:dbError?{message:'DB error'}:null}),
    order(key,params){calls.push({kind:'order',table,key,params});return this;},
    limit:async limit=>{calls.push({kind:'limit',table,limit,filters:{...filters}});
      const rows=locations.filter(x=>!('job_id' in x)||x.job_id===filters.job_id)
        .filter(x=>!('driver_id' in x)||x.driver_id===filters.driver_id)
        .sort((a,b)=>Date.parse(b.recorded_at)-Date.parse(a.recorded_at)).slice(0,limit);
      return {data:rows,error:null};
    }
   };
 }};
 const exports={};
 const requireMock=id=>{
   if(id==='next/server')return {NextResponse:{json:(data,opts)=>({status:opts.status,body:data,headers:opts.headers})}};
   if(id==='../../_lib/webDriver')return {requireWebDriver:async()=>driver};
   if(id==='../../mobile/_lib')return {isDriverContext:value=>Boolean(value&&value.driverId)};
   if(id==='../../../_lib/supabaseAdmin')return {supabaseAdmin:admin};
   throw Error('Unexpected import '+id);
 };
 const sandbox={exports,URL,Number,Date,Promise,console,
  NextResponse:requireMock('next/server').NextResponse,
  requireWebDriver:requireMock('../../_lib/webDriver').requireWebDriver,
  isDriverContext:requireMock('../../mobile/_lib').isDriverContext,
  supabaseAdmin:admin};
 vm.runInNewContext(js,sandbox,{filename:'booking-route-contract.js'});
 return {response:await exports.GET({url}),calls};
}
let outcome=await perform();
assert.equal(outcome.response.status,200);
assert.equal(outcome.response.body.gps_history_kind,'sampled_recorded_positions');
assert.equal(outcome.response.body.gps_trail.length,3,'Duplicate + invalid positions excluded');
assert.equal(outcome.response.body.gps_trail[0].recorded_at,'2026-11-22T10:00:00Z','History in chronological order');
assert.equal(outcome.response.body.pickup.lat,53.75);
assert.equal(outcome.response.headers['Cache-Control'],'private, no-store, max-age=0');
assert.deepEqual(outcome.calls.find(c=>c.kind==='limit').filters,{job_id:BOOKING_ID,driver_id:OWN_DRIVER},'GPS is filtered to assigned driver AND job');
outcome=await perform({job:{...dbJob,assigned_driver_id:'other-driver'}});
assert.equal(outcome.response.status,403,'No cross-driver access');
assert.equal(outcome.calls.some(c=>c.table==='driver_locations'),false,'No GPS query after access rejected');
outcome=await perform({job:{...dbJob,awarded_carrier_company_id:'other-carrier'}});
assert.equal(outcome.response.status,403,'Carrier boundary protected');
outcome=await perform({driver:{status:401},job:dbJob});
assert.equal(outcome.response.status,401,'Unauthenticated rejected');
outcome=await perform({url:'https://xdrive.example/api/driver/web/booking-route?jobId=not-a-uuid'});
assert.equal(outcome.response.status,400,'Malformed booking ID rejected');
outcome=await perform({job:null});
assert.equal(outcome.response.status,403,'Nonexistent booking does not expose GPS');
outcome=await perform({dbError:true});
assert.equal(outcome.response.status,500,'Database error fails closed');
console.log('BOOKING_ROUTE_SECURITY_PASS: auth, ownership, carrier, job+driver scoping, privacy, chronological samples, invalid locations');
