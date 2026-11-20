import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/financePermissions', async () => import('../lib/financePermissions'));
const ID='11111111-1111-4111-8111-111111111111';
const h=vi.hoisted(()=>({profileStatus:'active',companyStatus:'active',role:'admin',profileError:false,missingProfile:false,foreign:false,queries:[] as string[],write:vi.fn(),signed:vi.fn(),rpc:vi.fn(),stripe:vi.fn()}));
vi.mock('../app/api/_lib/stripeServer',()=>({isStripeServerConfigured:true,stripeRequest:h.stripe}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({
 isSupabaseAdminConfigured:true,getBearerToken:()=> 'test-token',
 supabaseValidator:{auth:{getUser:async()=>({data:{user:{id:'actor'}},error:null})}},
 supabaseAdmin:{
 rpc:h.rpc,storage:{from:()=>({createSignedUrl:h.signed})},
 from:(table:string)=>{
 h.queries.push(table);
 const f:Record<string,unknown>={};
 let writing=false;
 const row=()=>{if(table==='profiles')return h.missingProfile?null:{role:'company_admin',status:h.profileStatus};
 if(table==='company_memberships')return h.foreign||(f['companies.status']==='active'&&h.companyStatus!=='active')?null:{company_id:'buyer',role_in_company:h.role,status:'active'};
 if(table==='invoices')return {id:'11111111-1111-4111-8111-111111111111',company_id:'supplier',buyer_company_id:'buyer',supplier_company_id:'supplier',status:'Sent',payment_status:'unpaid',approved_at:'2026-11-01',delivery_state:'sent',amount:100,net_amount:100,client_name:'Synthetic',currency:'GBP'};
 if(table==='invoice_documents')return {id:'doc',company_id:'supplier',file_url:'supplier/11111111-1111-4111-8111-111111111111/test.pdf'};
 if(table==='stripe_connected_accounts')return {stripe_account_id:'fixture',charges_enabled:true,payouts_enabled:true,details_submitted:true};
 return null};
 const error=()=>table==='profiles'&&h.profileError?{message:'test lookup error'}:null;
 const q={select:()=>q,eq:(k:string,v:unknown)=>{f[k]=v;return q},is:()=>q,in:()=>q,or:()=>q,limit:()=>q,order:()=>q,
 update:(v:unknown)=>{writing=true;h.write(table,v);return q},insert:(v:unknown)=>{writing=true;h.write(table,v);return q},
 maybeSingle:async()=>({data:row(),error:error()}),single:async()=>({data:{id:'payment',amount:10,currency:'GBP'},error:null}),
 then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:writing?null:table==='company_memberships'?(row()?[row()]:[]):[],error:error()}).then(resolve)};
 return q;
 }
 }
}));
import {GET as detail} from '../app/api/finance/invoices/[id]/route';
import {GET as document} from '../app/api/finance/invoice-document-url/route';
import {POST as approve} from '../app/api/admin/invoices/[id]/approve/route';
import {POST as checkout} from '../app/api/payments/jobs/checkout/route';
import {POST as payment} from '../app/api/admin/invoices/[id]/payment-history/route';
import {GET as control} from '../app/api/workspace/finance/control/route';
const params={params:Promise.resolve({id:ID})};
const get=()=>new NextRequest('https://example.invalid/?invoiceId='+ID+'&documentId=doc');
const post=()=>new NextRequest('https://example.invalid/',{method:'POST',body:JSON.stringify({invoiceId:ID,amount:10,idempotency_key:'synthetic'})});
const routes=[['detail',()=>detail(get(),params)],['document',()=>document(get())],['approve',()=>approve(post(),params)],['checkout',()=>checkout(post())],['payment',()=>payment(post(),params)],['control',()=>control(get())]] as const;
beforeEach(()=>{Object.assign(h,{profileStatus:'active',companyStatus:'active',role:'admin',profileError:false,missingProfile:false,foreign:false,queries:[]});h.write.mockClear();h.signed.mockReset().mockResolvedValue({data:{signedUrl:'https://example.invalid/synthetic'},error:null});h.rpc.mockReset().mockResolvedValue({data:{id:'attempt',amount_minor:10000,currency:'gbp',return_path:'/customer/invoices/test'},error:null});h.stripe.mockReset().mockResolvedValue({id:'session',url:'https://example.invalid/synthetic'});});
describe.each(routes)('%s: active profile and tenant finance boundary',(_name,invoke)=>{
 it.each(['suspended','pending','rejected'])('denies %s profile prior to commercial reads or effects',async status=>{h.profileStatus=status;expect((await invoke()).status).toBe(403);expect(h.queries).not.toContain('invoices');expect(h.write).not.toHaveBeenCalled();expect(h.signed).not.toHaveBeenCalled();expect(h.rpc).not.toHaveBeenCalled();expect(h.stripe).not.toHaveBeenCalled();});
 it('denies missing profile',async()=>{h.missingProfile=true;expect((await invoke()).status).toBe(403);expect(h.write).not.toHaveBeenCalled();});
 it('fails closed on profile lookup error',async()=>{h.profileError=true;expect((await invoke()).status).toBe(500);expect(h.write).not.toHaveBeenCalled();});
 it('blocks inactive tenant from commercial access',async()=>{h.companyStatus='suspended';const r=await invoke();if(_name==='control'){expect(r.status).toBe(200);expect(await r.json()).toMatchObject({invoices:[],readyToInvoice:[]});}else expect(r.status).toBe(403);expect(h.write).not.toHaveBeenCalled();expect(h.signed).not.toHaveBeenCalled();expect(h.rpc).not.toHaveBeenCalled();});
 it('preserves active authorized buyer behavior',async()=>{const r=await invoke();expect(r.status).toBe(_name==='payment'?201:200);});
});
