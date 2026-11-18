import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { renderToStaticMarkup } from 'react-dom/server';
import { InvoiceProStatusTabs } from '../app/components/workspace/InvoiceProMasterFrame';
import { summarizeInvoiceValueScopes, isAwaitingPaymentInvoiceStatus } from '../lib/invoiceStatus';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const state=vi.hoisted(()=>({
  denied:false,error:false,signError:false,
  rows:[] as Array<Record<string,unknown>>,
  signed:vi.fn(),
}));
vi.mock('../app/api/driver/_lib/webDriver',()=>({
  requireWebDriver:async()=>state.denied?NextResponse.json({error:'Unauthorized'},{status:401}):{userId:'user-a',driverId:'driver-a',companyId:'company-a'},
}));
vi.mock('../app/api/driver/mobile/_lib',()=>({isDriverContext:(v:object)=>'userId' in v}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({
  isSupabaseAdminConfigured:true,
  supabaseAdmin:{
    from(table:string){
      if(table!=='driver_documents')throw Error('Unexpected table '+table);
      const filters:Array<[string,unknown]>=[];
      const chain={
        select:()=>chain,
        eq:(field:string,value:unknown)=>{filters.push([field,value]);return chain;},
        maybeSingle:async()=>state.error?{data:null,error:{message:'fixture error'}}:{data:state.rows.find(r=>filters.every(([k,v])=>r[k]===v))??null,error:null},
      };
      return chain;
    },
    storage:{from:(bucket:string)=>({createSignedUrl:async(file:string,seconds:number)=>{
      state.signed(bucket,file,seconds);
      return state.signError?{data:null,error:{message:'fixture signing error'}}:{data:{signedUrl:'https://placeholder.supabase.co/storage/v1/object/sign/driver-docs/'+file+'?token=fixture'},error:null};
    }})},
  },
}));
import { GET } from '../app/api/driver/documents/[id]/download/route';
const call=(target=id)=>GET(new NextRequest('http://localhost/api/driver/documents/'+target+'/download'),{params:Promise.resolve({id:target})});
beforeEach(()=>{
  state.denied=false;state.error=false;state.signError=false;state.signed.mockReset();
  state.rows=[{id,driver_id:'driver-a',file_path:'company-a/driver-a/file.pdf'}];
});
describe('Owner Driver secure document download',()=>{
  it('signs only owned files for 60 seconds and disables caching',async()=>{
    const response=await call();expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).url).toContain('company-a/driver-a/file.pdf');
    expect(state.signed).toHaveBeenCalledExactlyOnceWith('driver-docs','company-a/driver-a/file.pdf',60);
  });
  it('denies unauthenticated and invalid IDs',async()=>{
    state.denied=true;expect((await call()).status).toBe(401);
    state.denied=false;expect((await call('invalid')).status).toBe(400);expect(state.signed).not.toHaveBeenCalled();
  });
  it('denies another driver record and cross-company file paths',async()=>{
    state.rows[0].driver_id='driver-b';expect((await call()).status).toBe(404);
    state.rows[0].driver_id='driver-a';state.rows[0].file_path='company-b/driver-a/file.pdf';
    expect((await call()).status).toBe(403);expect(state.signed).not.toHaveBeenCalled();
  });
  it('fails closed on lookup or signing failures',async()=>{
    state.error=true;expect((await call()).status).toBe(500);expect(state.signed).not.toHaveBeenCalled();
    state.error=false;state.signError=true;expect((await call()).status).toBe(503);
  });
});
describe('Invoice Pro approved finance contract',()=>{
  it('renders the invoice lifecycle tablist accessible name in the actual shared component',()=>{
    const html=renderToStaticMarkup(<InvoiceProStatusTabs tabs={[{id:'all',label:'All',active:true,onSelect:()=>{}},{id:'paid',label:'Paid',active:false,onSelect:()=>{}}]}/>);
    expect(html).toContain('role="tablist" aria-label="Invoice states"');expect(html).toContain('aria-selected="true"');expect(html).not.toContain('Payment states');
  });
  it('excludes drafts and cancelled invoices from issued balances',()=>{
    const summary=summarizeInvoiceValueScopes([{status:'Draft',amount:120,outstanding_amount:120},{status:'Sent',amount:240,outstanding_amount:100},{status:'Cancelled',amount:360,outstanding_amount:360},{status:'Paid',amount:480,outstanding_amount:0}]);
    expect(summary.gross).toBe(1200);expect(summary.issuedGross).toBe(720);expect(summary.issuedOutstanding).toBe(100);
    expect(isAwaitingPaymentInvoiceStatus('Overdue')).toBe(true);expect(isAwaitingPaymentInvoiceStatus('Paid')).toBe(false);
  });
});
