import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  enabled: true,
  context: {driverId:'driver-1', companyId:'company-1'} as unknown,
  job: {id:'job-1'} as unknown,
  jobError: null as unknown,
  docs: [{id:'file-1',name:'receipt.pdf'}] as unknown[],
  storageError: null as unknown,
  folder: '',
}));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: {
    from: () => ({select: () => ({eq() {return this;}, maybeSingle: async()=>({data:state.job,error:state.jobError})})}),
    storage: {from:()=>({list:async(folder:string)=>{state.folder=folder;return {data:state.docs,error:state.storageError};}})},
  },
}));
vi.mock('../app/api/_lib/platformFlags',()=>({getFeatureFlag:async()=>state.enabled}));
vi.mock('../app/api/driver/_lib/webDriverContext',()=>({
  requireActiveWebDriver:async()=>state.context,
  isWebDriverContext:(value:unknown)=>Boolean(value&&typeof value==='object'&&'driverId' in value),
}));
vi.mock('../app/api/driver/mobile/_lib',()=>({respond:(status:number,payload:unknown)=>Response.json(payload,{status})}));
import {GET} from '../app/api/driver/web/jobs/[id]/evidence/route';
const request=()=>({headers:new Headers()} as never);
const params={params:Promise.resolve({id:'job-1'})};

describe('collection evidence GET runtime',()=>{
  beforeEach(()=>{state.enabled=true;state.context={driverId:'driver-1',companyId:'company-1'};state.job={id:'job-1'};state.jobError=null;state.storageError=null;state.docs=[{id:'file-1',name:'receipt.pdf'}];state.folder='';});
  it('blocks disabled POD capture',async()=>{state.enabled=false;expect((await GET(request(),params)).status).toBe(503);});
  it('returns unauthorized context',async()=>{state.context=new Response('Unauthorized',{status:401});expect((await GET(request(),params)).status).toBe(401);});
  it('requires company',async()=>{state.context={driverId:'driver-1',companyId:null};expect((await GET(request(),params)).status).toBe(403);});
  it('does not expose unassigned job',async()=>{state.job=null;expect((await GET(request(),params)).status).toBe(404);});
  it('does not reveal database errors',async()=>{state.jobError={message:'internal details'};const r=await GET(request(),params);expect(r.status).toBe(500);expect(JSON.stringify(await r.json())).not.toContain('internal details');});
  it('ignores unsafe file names and directory placeholders',async()=>{state.docs=[{id:'good',name:'receipt.pdf'},{id:'bad',name:'../secret'},{id:null,name:'folder'}];const r=await GET(request(),params);expect(r.status).toBe(200);expect(await r.json()).toEqual({ok:true,paths:['company-1/job-1/collection-documents/receipt.pdf']});});
  it('does not expose storage errors',async()=>{state.storageError={message:'private'};const r=await GET(request(),params);expect(r.status).toBe(500);expect(JSON.stringify(await r.json())).not.toContain('private');});
  it('returns stored paths confined to company and job',async()=>{const r=await GET(request(),params);expect(r.status).toBe(200);expect(state.folder).toBe('company-1/job-1/collection-documents');expect(await r.json()).toEqual({ok:true,paths:['company-1/job-1/collection-documents/receipt.pdf']});});
});
