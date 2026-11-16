const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'../..');
function load(rel,mocks){
 const src=fs.readFileSync(path.join(root,rel),'utf8');
 const js=stripTypeScriptTypes(src,{mode:'transform'})
  .replace(/^import\s+.*?from\s+'([^']+)';?\s*$/gm,(full,id)=>{
   const names=full.match(/\{([^}]+)\}/);
   return names?'const {'+names[1].replace(/\btype\s+/g,'')+'}=require('+JSON.stringify(id)+');':'';
  }).replace(/export async function (GET|PUT|POST)\s*\(/g,'async function $1(')
  +'\nif(typeof POST==="function")exports.POST=POST;';
 const exports={};
 vm.runInNewContext(js,{exports,require:(id)=>{
  for(const [key,value] of Object.entries(mocks))if(id.endsWith(key))return value;
  throw Error('Unexpected import '+id);
 },Date,JSON,Error,Number,String,Boolean,Array,Object,Promise,RegExp,console,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://qa.example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-publishable'}}},{filename:rel,timeout:2000});
 return exports;
}
const reply=(status,body)=>({status,body});
const statusRel='app/api/driver/mobile/jobs/[id]/status/route.ts';
const undoRel='app/api/driver/mobile/jobs/[id]/undo-status/route.ts';
function makeScenario({status='accepted',owner=true,feature=true,jobExists=true,race=false}={}){
 let job={id:'qa-status-job',assigned_driver_id:'qa-driver',status,current_status:status,status_history:[],on_my_way_at:null,on_site_pickup_at:null,loaded_at:null,on_site_delivery_at:null};
 const calls={atomic:0,reads:0,updates:0,tracking:[]};
 let afterRead=false;
 const chain=(mode,update)=>{
  const filters={};
  const q={
   eq(field,value){filters[field]=value;return q;},
   select(){return q;},
   async maybeSingle(){
    if(mode==='select'){calls.reads++;afterRead=true;
     return {data:jobExists&&job&&filters.id===job.id&&filters.assigned_driver_id===job.assigned_driver_id?{...job}:null,error:null};
    }
    if(race&&afterRead)job.current_status='on_site_pickup';
    if(!jobExists||!job||filters.id!==job.id||filters.assigned_driver_id!==job.assigned_driver_id||filters.current_status!==job.current_status)return {data:null,error:null};
    calls.updates++;
    job={...job,...update};
    return {data:{...job},error:null};
   }
  };
  return q;
 };
 const db={from(table){
  if(table!=='jobs')throw Error('Unexpected table '+table);
  return {select:()=>chain('select'),update:values=>chain('update',values)};
 }};
 const requireDriver=async()=>owner?{driverId:'qa-driver',userId:'qa-user'}:reply(403,{error:'Forbidden'});
 const context={'_lib/supabaseAdmin':{isSupabaseAdminConfigured:true,supabaseAdmin:db,getBearerToken:()=> 'qa-token'},
  '_lib/platformFlags':{getFeatureFlag:async()=>feature},
  'supabase/supabase-js':{createClient:()=>({rpc:async(name,args)=>{
   calls.atomic++;
   if(name!=='driver_update_job_status_atomic')throw Error('Unexpected RPC');
   if(!owner||args.p_driver_id!=='qa-driver'||args.p_job_id!==job.id)return {error:{code:'42501',message:'Denied'},data:null};
   const allowed={accepted:['on_my_way'],on_my_way:['on_site_pickup'],on_site_pickup:['loaded'],loaded:['in_transit'],in_transit:['on_site_delivery'],on_site_delivery:['delivered']};
   if(!(allowed[job.current_status]||[]).includes(args.p_next_status))return {error:{code:'23514',message:'Invalid transition'},data:null};
   job.current_status=args.p_next_status;job.status=args.p_next_status;
   job.status_history.push({status:args.p_next_status,source:'qa-atomic-mock'});
   return {data:{status:job.current_status},error:null};
  }})},
  'next/server':{},
  '_lib':{
   getBearerToken:()=> 'qa-token',isDriverContext:result=>Boolean(result?.driverId),
   requireDriver,respond:reply,
   jobSelect:'id,current_status,status,assigned_driver_id,status_history',
   mapJob:row=>row,appendStatusHistory:(history,event)=>[...(history||[]),event],
   insertTrackingEvent:async(...args)=>{calls.tracking.push(args);return null}
  }};
 // The two relative _lib imports differ in filenames; mapping by suffix is deliberate.
 context['_lib/supabaseAdmin']=context['_lib/supabaseAdmin'];
 context['_lib/platformFlags']=context['_lib/platformFlags'];
 context['_lib/supabase-js']=context['supabase/supabase-js'];
 context['_lib']=context['_lib'];
 const statusRoute=load(statusRel,context);
 const undoRoute=load(undoRel,context);
 const req=body=>({json:async()=>body});
 const params={params:Promise.resolve({id:'qa-status-job'})};
 return {calls,statusRoute,undoRoute,req,params,get job(){return job}};
}
test('actual status handler + actual Undo handler: accepted -> on_my_way -> accepted, with tracking',async()=>{
 const s=makeScenario();
 assert.equal((await s.statusRoute.POST(s.req({nextStatus:'on_my_way'}),s.params)).status,200);
 assert.equal(s.job.current_status,'on_my_way');
 assert.equal((await s.undoRoute.POST(s.req({expectedCurrentStatus:'on_my_way'}),s.params)).status,200);
 assert.equal(s.job.current_status,'accepted');
 assert.equal(s.calls.atomic,1);
 assert.equal(s.calls.updates,1);
 assert.equal(s.calls.tracking.length,1);
 assert.equal(s.job.status_history.at(-1).source,'driver_mobile_undo');
});
test('Undo duplicate expected current is idempotent and does not roll back twice',async()=>{
 const s=makeScenario();
 await s.statusRoute.POST(s.req({nextStatus:'on_my_way'}),s.params);
 const first=await s.undoRoute.POST(s.req({expectedCurrentStatus:'on_my_way'}),s.params);
 const second=await s.undoRoute.POST(s.req({expectedCurrentStatus:'on_my_way'}),s.params);
 assert.equal(first.status,200);
 assert.equal(second.status,200);
 assert.equal(second.body.idempotent,true);
 assert.equal(s.calls.updates,1);
});
test('Undo stale expected state rejects without changing job',async()=>{
 const s=makeScenario({status:'loaded'});
 const result=await s.undoRoute.POST(s.req({expectedCurrentStatus:'on_site_pickup'}),s.params);
 assert.equal(result.status,409);
 assert.equal(s.job.current_status,'loaded');
 assert.equal(s.calls.updates,0);
});
test('Undo refuses delivered and completed jobs',async()=>{
 for(const status of ['delivered','completed']){
  const s=makeScenario({status});
  const result=await s.undoRoute.POST(s.req({expectedCurrentStatus:status}),s.params);
  assert.equal(result.status,409);
  assert.equal(s.calls.updates,0);
 }
});
test('Undo denies unassigned driver without touching DB',async()=>{
 const s=makeScenario({owner:false});
 assert.equal((await s.undoRoute.POST(s.req({expectedCurrentStatus:'accepted'}),s.params)).status,403);
 assert.equal(s.calls.reads,0);
});
test('Status denies unassigned driver without calling atomic RPC',async()=>{
 const s=makeScenario({owner:false});
 assert.equal((await s.statusRoute.POST(s.req({nextStatus:'on_my_way'}),s.params)).status,403);
 assert.equal(s.calls.atomic,0);
});
test('Status rejects invalid next state without DB mutation',async()=>{
 const s=makeScenario();
 assert.equal((await s.statusRoute.POST(s.req({nextStatus:'arbitrary'}),s.params)).status,400);
 assert.equal(s.calls.atomic,0);
});
test('Undo atomic compare-and-swap conflict returns 409',async()=>{
 const s=makeScenario({status:'loaded',race:true});
 const result=await s.undoRoute.POST(s.req({expectedCurrentStatus:'loaded'}),s.params);
 assert.equal(result.status,409);
 assert.equal(s.calls.updates,0);
});
test('Feature flag blocks both status and Undo without writes',async()=>{
 const s=makeScenario({feature:false});
 assert.equal((await s.statusRoute.POST(s.req({nextStatus:'on_my_way'}),s.params)).status,503);
 assert.equal((await s.undoRoute.POST(s.req({expectedCurrentStatus:'accepted'}),s.params)).status,503);
 assert.equal(s.calls.atomic,0);
 assert.equal(s.calls.updates,0);
});
