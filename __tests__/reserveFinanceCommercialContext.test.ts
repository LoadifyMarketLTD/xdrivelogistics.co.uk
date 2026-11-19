import {describe,it,beforeEach,expect,vi} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
const m=vi.hoisted(()=>({from:vi.fn(),user:vi.fn(),access:vi.fn()}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({isSupabaseAdminConfigured:true,supabaseAdmin:{from:m.from,auth:{getUser:m.user}},getBearerToken:()=> 'test-token'}));
vi.mock('../app/api/driver/finance/_lib/financeAccess',()=>({requireDriverFinanceAccess:m.access}));
import {GET} from '../app/api/driver/finance/jobs/eligible/route';
const id='db68930a-4488-430e-956b-27eb64f60297';
const baseJob={id,company_id:'buyer',awarded_carrier_company_id:'carrier',exchange_visibility:'exchange',current_status:'delivered',pod_generated:true,delivery_photos:['photo.jpg'],client_signature_name:'QA only',delivery_signature_data:{type:'recipient_typed_name_attestation'},currency:'GBP'};
const agreement={job_id:id,supplier_company_id:'carrier',agreed_amount:10,vat_rate:0,vat_amount:0,agreed_gross_amount:10,currency:'GBP',payment_terms:'30 days',payment_due_days:30};
let job:any, agreements:any[], invoices:any[];
function chain(data:any){const q:any={select:vi.fn(),eq:vi.fn(),or:vi.fn(),order:vi.fn(),in:vi.fn(async()=>({data,error:null})),limit:vi.fn(async()=>({data,error:null})),maybeSingle:vi.fn(async()=>({data,error:null}))};for(const f of ['select','eq','or','order'])q[f].mockReturnValue(q);return q;}
beforeEach(()=>{vi.resetAllMocks();job={...baseJob};agreements=[agreement];invoices=[];m.user.mockResolvedValue({data:{user:{id:'actor'}},error:null});m.access.mockResolvedValue({ok:true,context:{companyId:'carrier'}});m.from.mockImplementation((t:string)=>chain(t==='drivers'?{id:'driver',company_id:'carrier'}:t==='company_memberships'?{role_in_company:'owner'}:t==='jobs'?[job]:t==='invoices'?invoices:agreements));});
const get=(query='jobId='+id)=>GET(new NextRequest('https://www.xdrivelogistics.co.uk/api/driver/finance/jobs/eligible?'+query));
describe('Reserve commercial context separated from issue authority',()=>{
 it('returns verified contract rate, VAT, terms and due days even when POD is incomplete, without enabling issue',async()=>{const r=await get();expect(r.status).toBe(200);const j=await r.json();expect(j.rows).toEqual([]);expect(j.blocker).toBe('DRAWN_SIGNATURE_REQUIRED');expect(j.context).toMatchObject({id,agreed_amount:10,agreed_vat_rate:0,agreed_gross_amount:10,payment_terms:'30 days',payment_due_days:30,can_create_invoice:false});});
 it('retains legacy list eligibility boundary',async()=>{expect(await (await get('')).json()).toEqual({rows:[]});});
 it('allows issue when POD and contractual terms are verified',async()=>{job.delivery_signature_data='data:image/png;base64,AAAA';const j=await (await get()).json();expect(j.rows).toHaveLength(1);expect(j.context.can_create_invoice).toBe(true);expect(j.blocker).toBeNull();});
 it('requires the company to be the commercial supplier',async()=>{agreements=[];const j=await (await get()).json();expect(j.context).toBeNull();expect(j.rows).toEqual([]);});
 it('protects the richer context with active owner/admin finance permission',async()=>{m.access.mockResolvedValue({ok:false,response:NextResponse.json({error:'denied'},{status:403})});expect((await get()).status).toBe(403);expect(m.from.mock.calls.some(c=>c[0]==='jobs')).toBe(false);});
 it('keeps an existing official invoice available even when POD is blocked',async()=>{invoices=[{id:'inv',job_id:id}];const j=await (await get()).json();expect(j.invoice.id).toBe('inv');expect(j.context.can_create_invoice).toBe(false);});
 it('blocks choosing or creating a new invoice when multiple records exist',async()=>{invoices=[{id:'inv',job_id:id},{id:'inv2',job_id:id}];const j=await (await get()).json();expect(j.blocker).toBe('MULTIPLE_INVOICES');expect(j.invoice).toBeNull();expect(j.context.can_create_invoice).toBe(false);});
 it('returns contextual history state for blocked and ready jobs only through opt-in',async()=>{const j=await (await get('reserveContexts=1')).json();expect(j.contexts).toHaveLength(1);expect(j.contexts[0].blocker).toBe('DRAWN_SIGNATURE_REQUIRED');});
});