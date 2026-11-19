import {describe,it,expect,vi,beforeEach} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
const m=vi.hoisted(()=>({access:vi.fn(),eligible:vi.fn()}));
vi.mock('../app/api/driver/finance/_lib/financeAccess',()=>({requireDriverFinanceAccess:m.access}));
vi.mock('../app/api/driver/finance/jobs/eligible/route',()=>({GET:m.eligible}));
import {GET} from '../app/api/driver/finance/jobs/[jobId]/invoice-context/route';
const jobId='db68930a-4488-430e-956b-27eb64f60297';
const request=new NextRequest('https://www.xdrivelogistics.co.uk/api/driver/finance/jobs/'+jobId+'/invoice-context?jobId=wrong');
const params={params:Promise.resolve({jobId})};
beforeEach(()=>{vi.resetAllMocks();m.access.mockResolvedValue({ok:true,context:{companyId:'carrier'}});m.eligible.mockResolvedValue(NextResponse.json({rows:[{id:jobId,commercial_mode:'marketplace'},{id:'another'}]}));});
describe('Reserve per-job invoice context',()=>{
 it('denies unauthorized finance access before eligibility lookup',async()=>{m.access.mockResolvedValue({ok:false,response:NextResponse.json({error:'denied'},{status:403})});expect((await GET(request,params)).status).toBe(403);expect(m.eligible).not.toHaveBeenCalled();});
 it('rejects invalid ids',async()=>{expect((await GET(request,{params:Promise.resolve({jobId:'bad'})})).status).toBe(400);expect(m.eligible).not.toHaveBeenCalled();});
 it('scopes lookup to path job, removes unrelated rows and prevents caching',async()=>{const r=await GET(request,params);expect(r.status).toBe(200);expect(m.eligible.mock.calls[0][0].nextUrl.searchParams.get('jobId')).toBe(jobId);expect(await r.json()).toEqual({rows:[{id:jobId,commercial_mode:'marketplace'}]});expect(r.headers.get('cache-control')).toBe('private, no-store');});
 it('does not invent eligibility for missing rows',async()=>{m.eligible.mockResolvedValue(NextResponse.json({rows:[]}));expect(await (await GET(request,params)).json()).toEqual({rows:[]});});
 it('passes only the requested job commercial context while preserving a POD blocker',async()=>{m.eligible.mockResolvedValue(NextResponse.json({rows:[],context:{id:jobId,agreed_amount:10,can_create_invoice:false},blocker:'DRAWN_SIGNATURE_REQUIRED'}));expect(await (await GET(request,params)).json()).toEqual({rows:[],context:{id:jobId,agreed_amount:10,can_create_invoice:false},blocker:'DRAWN_SIGNATURE_REQUIRED'});m.eligible.mockResolvedValue(NextResponse.json({rows:[],context:{id:'other',agreed_amount:123}}));expect(await (await GET(request,params)).json()).toEqual({rows:[]});});
 it('preserves upstream failures',async()=>{m.eligible.mockResolvedValue(NextResponse.json({error:'unavailable'},{status:503}));expect((await GET(request,params)).status).toBe(503);});
});