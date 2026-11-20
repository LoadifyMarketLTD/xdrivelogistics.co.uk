import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { hasCompletePodEvidence } from '../lib/jobs/podCompletion';

// Exercise the actual event-handler body, with synthetic UI state and isolated network stubs.
const source = readFileSync('app/components/workspace/DriverJobExecutionPage.tsx','utf8');
const ast=ts.createSourceFile('DriverJobExecutionPage.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function handler(name:string,scope:Record<string,unknown>){
  let node:ts.ArrowFunction|undefined;
  function visit(n:ts.Node){
    if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name&&n.initializer&&ts.isArrowFunction(n.initializer))node=n.initializer;
    ts.forEachChild(n,visit);
  }
  visit(ast);
  if(!node)throw Error('Handler missing: '+name);
  const js=ts.transpileModule('return ('+(node as ts.ArrowFunction).getText(ast)+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(scope),js)(...Object.values(scope)) as (...args:unknown[])=>Promise<unknown>;
}
const validJob={id:'synthetic-job',pod_generated:true,delivery_photos:['company/job/photos/photo.jpg'],delivery_signature_data:'company/job/signature.png',client_signature_name:'Synthetic receiver'};
const makeInvoiceScope=(job:unknown=validJob,permission=true)=>({
 job,canGenerateInvoices:permission,hasCompletePodEvidence,setWorking:vi.fn(),setMessage:vi.fn(),setError:vi.fn(),
 authHeader:async()=>'Bearer synthetic',fetch:vi.fn(async()=>({ok:true,json:async()=>({invoice:{id:'synthetic-invoice'}})})),
 router:{push:vi.fn()},loadJob:vi.fn(async()=>undefined),crypto:{randomUUID:()=> 'synthetic-key'},
});
describe('actual invoice draft handlers',()=>{
 it('creates a draft exactly once, never issues/submits, opens the web editor',async()=>{
   const s=makeInvoiceScope();await handler('createInvoice',s)();
   expect(s.fetch).toHaveBeenCalledTimes(1);
   expect(s.fetch).toHaveBeenCalledWith('/api/driver/finance/jobs/synthetic-job/generate-invoice',expect.objectContaining({method:'POST',body:JSON.stringify({idempotency_key:'synthetic-key'})}));
   expect(s.router.push).toHaveBeenCalledExactlyOnceWith('/driver/finance/invoices/synthetic-invoice/edit');
   expect(s.setMessage).toHaveBeenCalledWith(expect.stringMatching(/draft.*review.*before sending/i));
 });
 it('stays in approved mobile workflow at persisted draft, without automatically sending',async()=>{
   const s=makeInvoiceScope();await handler('createInvoice',s)(true);
   expect(s.fetch).toHaveBeenCalledTimes(1);expect(s.loadJob).toHaveBeenCalledTimes(1);expect(s.router.push).not.toHaveBeenCalled();
   expect(source).toContain('approvedScreen.number===9 && sheet?.invoices[0]?.id');
   expect(source).toContain("onEdit={()=>router.push('/driver/finance/invoices/'+encodeURIComponent(invoice.id!)+'/edit')}");
 });
 it('does not create an invoice without permission or complete POD',async()=>{
   for(const s of [makeInvoiceScope(validJob,false),makeInvoiceScope({...validJob,delivery_photos:[]}),makeInvoiceScope({...validJob,pod_generated:false})]){
     await handler('createInvoice',s)();expect(s.fetch).not.toHaveBeenCalled();expect(s.router.push).not.toHaveBeenCalled();
   }
 });
 it('blocks completed lifecycle transition before RPC when evidence is incomplete',async()=>{
   const fetch=vi.fn(),setError=vi.fn(),rpc=vi.fn();
   const s={job:{...validJob,delivery_photos:[]},driverId:'synthetic-driver',setWorking:vi.fn(),setError,setMessage:vi.fn(),hasCompletePodEvidence,fetch,supabase:{rpc}};
   await handler('moveStatus',s)('completed');expect(setError).toHaveBeenCalledWith('Complete POD before completing this job.');expect(fetch).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
 });
});
describe('POD draft explicit save and safe back navigation',()=>{
 const draftScope=()=>{
  const s={podJobId:'synthetic-job',podDraftLoaded:true,podAlreadyComplete:false,podDraftSaveTimer:{current:77 as number|null},clearTimeout:vi.fn(),podDraftSaveQueue:{current:Promise.resolve() as Promise<unknown>},recipientName:'New receiver',podLeftAt:'Reception',podDeliveryStatus:'Completed Delivery',podItemCount:'1',podWeight:'2',podDeliveredOn:'2026-11-20',notes:'Latest notes',savedSignatureData:'old',signatureData:()=> 'new-canvas',hardCopyAcknowledged:false,pendingPodPhotos:['photo'],pendingPodDocuments:['document'],authHeader:async()=> 'Bearer synthetic',fetch:vi.fn(async()=>({ok:true,json:async()=>({ok:true})})),setPodDraftSaving:vi.fn(),setPodDraftError:vi.fn(),setMessage:vi.fn(),ownerWeb:false,ownerHydratedSnapshot:{current:null}};
  return s;
 };
 it('cancels pending debounce, waits for prior save, queues latest snapshot and confirms server ack',async()=>{
  const s=draftScope();let release!:()=>void;s.podDraftSaveQueue.current=new Promise<void>(r=>{release=r});
  const op=handler('savePodDraftNow',s)();
  expect(s.clearTimeout).toHaveBeenCalledWith(77);expect(s.podDraftSaveTimer.current).toBeNull();expect(s.fetch).not.toHaveBeenCalled();
  release();expect(await op).toBe(true);
  expect(s.fetch).toHaveBeenCalledTimes(1);
  const req=s.fetch.mock.calls[0] as unknown as [string,{body:string;method:string}];
  expect(req[0]).toBe('/api/driver/web/jobs/synthetic-job/pod-draft');
  expect(req[1].method).toBe('PUT');expect(JSON.parse(req[1].body)).toMatchObject({recipientName:'New receiver',notes:'Latest notes',signatureData:'new-canvas',photoUris:['photo'],documentUris:['document']});
 });
 it('does not report success if server does not acknowledge the save',async()=>{
  const s=draftScope();s.fetch.mockResolvedValue({ok:true,json:async()=>({ok:false})});expect(await handler('savePodDraftNow',s)()).toBe(false);expect(s.setPodDraftError).toHaveBeenCalledWith(expect.any(String));
 });
 it('only returns to the same booking after the draft save succeeds',async()=>{
  const router={push:vi.fn()},savePodDraftNow=vi.fn(async()=>false);
  const s={working:false,podDraftSaving:false,podAlreadyComplete:false,savePodDraftNow,router,jobId:'synthetic/job'};
  await handler('returnFromPod',s)();expect(router.push).not.toHaveBeenCalled();
  savePodDraftNow.mockResolvedValue(true);await handler('returnFromPod',s)();expect(router.push).toHaveBeenCalledExactlyOnceWith('/driver/official-pwa-live?booking=synthetic%2Fjob');
 });
});
