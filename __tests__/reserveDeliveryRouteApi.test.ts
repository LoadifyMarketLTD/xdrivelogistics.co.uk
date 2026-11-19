import {describe,it,beforeEach,expect,vi} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
const m=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),driver:vi.fn(),flag:vi.fn()}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({isSupabaseAdminConfigured:true,getBearerToken:()=> 'fixture',supabaseAdmin:{from:m.from,rpc:m.rpc}}));
vi.mock('../app/api/_lib/platformFlags',()=>({getFeatureFlag:m.flag}));
vi.mock('../app/api/driver/mobile/_lib',()=>({requireDriver:m.driver,isDriverContext:(v:unknown)=>!(v instanceof Response),respond:(status:number,value:unknown)=>NextResponse.json(value,{status}),jobSelect:'id,is_test,current_status',insertTrackingEvent:vi.fn(),mapJob:vi.fn(),safeArray:()=>[]}));
import {POST} from '../app/api/driver/mobile/jobs/[id]/[action]/route';
let job:Record<string,unknown>|null,stops:Record<string,unknown>[],stopError:unknown;
function query(data:unknown,error:unknown=null){const q={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data,error})),then:(ok:(v:unknown)=>unknown)=>Promise.resolve({data,error}).then(ok)};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);return q;}
const call=(action:string)=>POST(new NextRequest('https://www.xdrivelogistics.co.uk/api/driver/mobile/jobs/job/'+action,{method:'POST',body:'{}'}),{params:Promise.resolve({id:'job',action})});
beforeEach(()=>{vi.resetAllMocks();m.flag.mockResolvedValue(true);m.driver.mockResolvedValue({userId:'actor',driverId:'driver',companyId:'carrier'});job={id:'job',is_test:true,current_status:'on_site_delivery'};stops=[{sequence:1,stop_type:'collection',status:'completed',handover:{version:3}},{sequence:2,stop_type:'delivery',status:'completed',handover:{version:3,stopKind:'return'}}];stopError=null;m.from.mockImplementation(name=>name==='jobs'?query(job):query(stops,stopError));});
describe('Delivery API custody gates',()=>{
 it('refuses return closure at Delivered boundary',async()=>{expect((await call('delivered')).status).toBe(409);expect(m.rpc).not.toHaveBeenCalled();});
 it('refuses normal POD even if parent is already marked Delivered',async()=>{job!.current_status='delivered';expect((await call('pod')).status).toBe(409);expect(m.rpc).not.toHaveBeenCalled();});
 it('checks assigned job before reading the POD route',async()=>{job=null;expect((await call('pod')).status).toBe(404);expect(m.from).toHaveBeenCalledTimes(1);});
 it('fails closed when route evidence cannot be read',async()=>{stopError={code:'PGRST205',message:'job_stops missing'};expect((await call('delivered')).status).toBe(503);expect(m.rpc).not.toHaveBeenCalled();});
});