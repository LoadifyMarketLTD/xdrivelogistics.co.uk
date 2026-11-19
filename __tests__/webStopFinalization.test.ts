import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateWebStopFinalization, type WebStopRow } from '../lib/jobs/webStopFinalization';
const stop=(sequence:number,stop_type:string,status='pending'):WebStopRow=>({sequence,stop_type,status,arrived_at:null,completed_at:null,handover:null});
const direct=()=>[stop(1,'collection'),stop(2,'delivery')];
const multi=()=>[stop(1,'collection','completed'),stop(2,'delivery'),stop(3,'delivery')];
const state=vi.hoisted(()=>({mode:'timed_direct',stops:[] as WebStopRow[],owned:true,stopError:false,jobError:false,authorized:true,rpc:vi.fn(),queries:[] as Array<[string,string,unknown]>}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({
 isSupabaseAdminConfigured:true,getBearerToken:()=>null,
 supabaseAdmin:{
  from(table:string){
   const filters:Record<string,unknown>={};
   const query={select:()=>query,eq:(key:string,value:unknown)=>{filters[key]=value;state.queries.push([table,key,value]);return query;},
    maybeSingle:async()=>({data:state.owned&&filters.assigned_driver_id==='driver-a'?{id:'fixture-job',service_mode:state.mode,status:'delivered',current_status:'delivered',pod_generated:false}:null,error:state.jobError?{message:'fixture failure'}:null}),
    then:(resolve:(value:unknown)=>unknown)=>resolve({data:state.stops,error:state.stopError?{message:'fixture failure'}:null})};
   return query;
  },rpc:state.rpc
 }
}));
vi.mock('../app/api/_lib/platformFlags',()=>({getFeatureFlag:async()=>true}));
vi.mock('../app/api/driver/_lib/webDriverContext',()=>({
 requireActiveWebDriver:async()=>state.authorized?{driverId:'driver-a',userId:'user-a',companyId:'company-a'}:new Response('Unauthorized',{status:401}),
 isWebDriverContext:(v:object)=>'driverId' in v
}));
vi.mock('../app/api/driver/mobile/_lib',()=>({
 jobSelect:'id,status,current_status,pod_generated',respond:(status:number,payload:unknown)=>Response.json(payload,{status}),
 safeArray:(value:unknown)=>Array.isArray(value)?value:[],mapJob:(value:unknown)=>value,insertTrackingEvent:vi.fn()
}));
import { POST } from '../app/api/driver/web/jobs/[id]/[action]/route';
const call=(action='pod')=>POST(new Request('http://localhost/api/driver/web/jobs/fixture-job/'+action,{method:'POST',body:'{}'}) as never,{params:Promise.resolve({id:'fixture-job',action})});
beforeEach(()=>{state.mode='timed_direct';state.stops=direct();state.owned=true;state.stopError=false;state.jobError=false;state.authorized=true;state.rpc.mockReset();state.queries=[];});
describe('Direct vs multi-stop finalization',()=>{
 it.each(['timed_direct','asap_direct','flexible','coload_permitted'])('unstarted standard %s follows canonical lifecycle',mode=>{
  expect(evaluateWebStopFinalization(mode,direct())).toEqual({kind:'direct',ready:true,remainingStops:0});
 });
 it('never bypasses extra stops even with direct service mode',()=>{
  for(const mode of ['timed_direct','multi_drop',null])expect(evaluateWebStopFinalization(mode,multi())).toEqual({kind:'multi_stop',ready:false,remainingStops:2});
 });
 it('never bypasses a partially executed two-stop route',()=>{
  const stops=direct();stops[0].status='arrived';stops[0].arrived_at='2026-10-04T12:00:00Z';
  expect(evaluateWebStopFinalization('timed_direct',stops).ready).toBe(false);
  stops[0].status='pending';expect(evaluateWebStopFinalization('timed_direct',stops).ready).toBe(false);
 });
 it('rejects explicitly multi-drop routes with missing or insufficient rows',()=>{
  for(const rows of [[],[stop(1,'collection')],direct()])expect(evaluateWebStopFinalization('multi_drop',rows).ready).toBe(false);
 });
 it('rejects corrupt sequence, unexpected or unknown status',()=>{
  expect(evaluateWebStopFinalization('timed_direct',[stop(1,'collection','completed'),stop(1,'delivery','completed')]).ready).toBe(false);
  expect(evaluateWebStopFinalization('timed_direct',[stop(1,'collection'),stop(2,'delivery','unknown')]).ready).toBe(false);
 });
 it('permits genuine multi-collection and multi-drop only when every stop is terminal',()=>{
  const stops=[stop(1,'collection','completed'),stop(2,'collection','completed'),stop(3,'delivery','skipped'),stop(4,'delivery','completed')];
  expect(evaluateWebStopFinalization('multi_drop',stops)).toEqual({kind:'multi_stop',ready:true,remainingStops:0});
 });
 it('does not assume an unclassified standard pending route is direct',()=>{
  expect(evaluateWebStopFinalization(null,direct()).ready).toBe(false);
 });
});
describe('Actual WEB POST route, entirely mocked, no database writes',()=>{
 it('passes historical direct stop gate but still rejects missing recipient',async()=>{
  const response=await call();expect(response.status).toBe(400);expect((await response.json()).error).toMatch(/Recipient name is required/);expect(state.rpc).not.toHaveBeenCalled();
 });
 it('blocks real incomplete multi-drop POD and Delivered actions',async()=>{
  state.mode='multi_drop';state.stops=multi();
  for(const action of ['pod','delivered']){const response=await call(action);expect(response.status).toBe(409);const body=await response.json();expect(body.code).toBe('STOPS_OUTSTANDING');expect(body.remainingStops).toBe(2);}
  expect(state.rpc).not.toHaveBeenCalled();
 });
 it('blocks incomplete route configuration and missing stop table',async()=>{
  state.mode='multi_drop';state.stops=[];let response=await call();expect(response.status).toBe(409);expect((await response.json()).code).toBe('STOP_ROUTE_UNVERIFIED');
  state.stopError=true;response=await call();expect(response.status).toBe(503);expect(state.rpc).not.toHaveBeenCalled();
 });
 it('requires assigned driver before accessing stop rows',async()=>{
  state.owned=false;expect((await call()).status).toBe(404);expect(state.queries.some(x=>x[0]==='job_stops')).toBe(false);
  state.authorized=false;expect((await call()).status).toBe(401);expect(state.rpc).not.toHaveBeenCalled();
 });
});
