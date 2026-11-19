import {describe,it,beforeEach,expect,vi} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
const m=vi.hoisted(()=>({from:vi.fn(),driver:vi.fn(),flag:vi.fn(),event:vi.fn(),insert:vi.fn()}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({isSupabaseAdminConfigured:true,supabaseAdmin:{from:m.from}}));
vi.mock('../app/api/_lib/platformFlags',()=>({getFeatureFlag:m.flag}));
vi.mock('../app/api/driver/mobile/_lib',()=>({requireDriver:m.driver,isDriverContext:(v:unknown)=>!(v instanceof Response),respond:(status:number,value:unknown)=>NextResponse.json(value,{status}),insertTrackingEvent:m.event}));
import {POST} from '../app/api/driver/mobile/jobs/[id]/extras/route';
const id='job',reqId='3b508a7a-45e3-4c37-a567-4ca426a4e710';
const body={requestId:reqId,extraType:'waiting_time',description:'QA only',amountGbp:15,minutes:30};
const stored={id:reqId,job_id:id,driver_id:'driver',supplier_company_id:'carrier',extra_type:'waiting_time',description:'QA only',amount_gbp:15,minutes:30,status:'submitted'};
let job:Record<string,unknown>,prior:Record<string,unknown>|null,agreement:Record<string,unknown>|null,collision:boolean;
function query(data:unknown){const q={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data,error:null}))};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);return q;}
const call=(payload:unknown=body)=>POST(new NextRequest('https://www.xdrivelogistics.co.uk/api/driver/mobile/jobs/job/extras',{method:'POST',body:JSON.stringify(payload)}),{params:Promise.resolve({id})});
beforeEach(()=>{vi.resetAllMocks();job={is_test:true,assigned_company_id:'carrier',assigned_driver_id:'driver',current_status:'loaded',pod_generated:false};prior=null;agreement={id:'agreement',currency:'GBP'};collision=false;m.driver.mockResolvedValue({userId:'actor',driverId:'driver',companyId:'carrier'});m.flag.mockResolvedValue(true);m.event.mockResolvedValue(undefined);m.insert.mockImplementation(()=>({select:()=>({single:async()=>{if(collision){prior=stored;return {data:null,error:{code:'23505'}}}prior=stored;return {data:stored,error:null}}})}));m.from.mockImplementation(name=>name==='jobs'?query(job):name==='job_commercial_agreements_effective'?query(agreement):{...query(prior),insert:m.insert});});
describe('Reserve execution charge idempotency',()=>{
 it('uses the caller request UUID as the database primary key',async()=>{expect((await call()).status).toBe(201);expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({id:reqId,job_id:id,supplier_company_id:'carrier',amount_gbp:15,status:'submitted'}));expect(m.event).toHaveBeenCalledTimes(1);});
 it('returns the exact existing request even if the job closed after submission',async()=>{prior=stored;job.current_status='delivered';job.pod_generated=true;const r=await call();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({duplicate:true,extra:stored});expect(m.insert).not.toHaveBeenCalled();expect(m.event).not.toHaveBeenCalled();});
 it('rejects changes to an existing charge identity',async()=>{prior=stored;expect((await call({...body,amountGbp:16})).status).toBe(409);expect(m.insert).not.toHaveBeenCalled();});
 it('recovers the winning record after a concurrent PK collision',async()=>{collision=true;const r=await call();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({duplicate:true,extra:stored});expect(m.event).not.toHaveBeenCalled();});
 it('rejects wrong carrier, real jobs, missing accepted agreement and closed new charges',async()=>{job.assigned_company_id='other';expect((await call()).status).toBe(403);job.assigned_company_id='carrier';job.is_test=false;expect((await call()).status).toBe(403);job.is_test=true;agreement=null;expect((await call()).status).toBe(409);agreement={id:'a',currency:'GBP'};job.pod_generated=true;expect((await call()).status).toBe(409);expect(m.insert).not.toHaveBeenCalled();});
 it('rejects invalid UUID and imprecise money or fractional minutes',async()=>{for(const p of [{...body,requestId:'fake'},{...body,amountGbp:15.001},{...body,minutes:30.5}])expect((await call(p)).status).toBe(400);expect(m.insert).not.toHaveBeenCalled();});
});