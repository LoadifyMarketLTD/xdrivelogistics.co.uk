import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
const m=vi.hoisted(()=>({access:vi.fn(),from:vi.fn(),select:vi.fn(),eq:vi.fn(),limit:vi.fn()}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({isSupabaseAdminConfigured:true,supabaseAdmin:{from:m.from}}));
vi.mock('../app/api/admin/_lib/requireCompanyCapability',()=>({requireCompanyCapability:m.access,isCompanyCapabilityContext:(v:unknown)=>!(v instanceof Response)}));
import {GET} from '../app/api/admin/bids/pending-offers/route';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const req=(company=id)=>new NextRequest('http://localhost/api/admin/bids/pending-offers?companyId='+company);
describe('Company Admin pending booking offer read endpoint',()=>{
 beforeEach(()=>{vi.clearAllMocks();m.access.mockResolvedValue({companyId:id});m.from.mockReturnValue({select:m.select});m.select.mockReturnValue({eq:m.eq});m.eq.mockReturnValue({eq:m.eq,limit:m.limit});m.limit.mockResolvedValue({data:[{id:'offer',buyer_company_id:id,status:'pending'}],count:1,error:null});});
 it('checks explicit company scope and award capability before querying',async()=>{const response=await GET(req());expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toContain('no-store');expect(m.access).toHaveBeenCalledWith(expect.anything(),id,'quotes.award');expect(m.from).toHaveBeenCalledWith('job_booking_offers');expect(m.eq).toHaveBeenCalledWith('buyer_company_id',id);expect(m.eq).toHaveBeenCalledWith('status','pending');expect((await response.json()).offers).toHaveLength(1);});
 it('does not query for invalid company input or denied membership',async()=>{expect((await GET(req('invalid'))).status).toBe(400);m.access.mockResolvedValue(NextResponse.json({error:'Forbidden'},{status:403}));expect((await GET(req())).status).toBe(403);expect(m.from).not.toHaveBeenCalled();});
 it('withholds incomplete or failed reads',async()=>{m.limit.mockResolvedValue({data:[],count:1,error:null});expect((await GET(req())).status).toBe(503);m.limit.mockResolvedValue({data:null,count:null,error:{message:'query failed'}});expect((await GET(req())).status).toBe(503);});
});
