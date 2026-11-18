import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildInvoicePdf } from '../lib/server/ownerInvoicePdf';
import { loadInvoicePdfContext } from '../lib/server/ownerInvoicePdfContext';

const COMPANY='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const JOB='33333333-3333-4333-8333-333333333333';
const PHOTO=COMPANY+'/'+JOB+'/delivery.png';
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVZkAAAAASUVORK5CYII=';
const image=Uint8Array.from(Buffer.from(PNG,'base64'));
const signature='data:image/png;base64,'+PNG;
const base={invoiceNumber:'FIXTURE-001',jobReference:'FIXTURE-JOB',invoiceDate:'2026-11-18',dueDate:'2026-12-18',issuerName:'Fixture Carrier Ltd',issuerAddress:'1 Example Street, London',clientName:'Fixture Customer Ltd',clientAddress:'2 Example Street, Leeds',netAmount:100,vatAmount:0,vatRate:0,vatTreatment:'not_registered' as const,totalAmount:100,currency:'GBP',paymentTerms:'30 days'};
const fixture=()=>{
 const job:Record<string,unknown>={id:JOB,company_id:COMPANY,assigned_company_id:null,awarded_carrier_company_id:null,exchange_visibility:'private',broker_pod_review_status:'approved',pod_generated:true,client_signature_name:'Fixture Recipient',delivery_photos:[PHOTO],pod_photos:[],pickup_photos:[],damage_photos:[],delivery_signature_data:signature,pickup_location:'Fixture Collection',delivery_location:'Fixture Delivery',delivered_at:'2026-11-18T12:00:00Z',pod_generated_at:'2026-11-18T12:05:00Z'};
 const pod:Record<string,unknown>={received_by:'Fixture Recipient',delivered_on:'2026-11-18',delivery_status:'Completed Delivery',no_of_items:1,photo_urls:[PHOTO],delivery_notes:'Fixture handover'};
 return {job,pod,agreement:true,downloads:[] as string[],missingJob:false};
};
function client(f:ReturnType<typeof fixture>):SupabaseClient{
 return {
  from(table:string){
   const query={select:()=>query,eq:()=>query,or:()=>query,order:()=>query,limit:()=>query,maybeSingle:async()=>{
    if(table==='companies')return {data:{email:'fixture@example.invalid'},error:null};
    if(table==='company_settings')return {data:{},error:null};
    if(table==='jobs')return {data:f.missingJob?null:f.job,error:null};
    if(table==='proof_of_delivery')return {data:f.pod,error:null};
    if(table==='job_commercial_agreements_effective')return {data:f.agreement?{id:'fixture-agreement'}:null,error:null};
    throw Error('Unexpected table: '+table);
   }};return query;
  },
  storage:{from:(bucket:string)=>({download:async(path:string)=>{
   expect(bucket).toBe('pod-photos');f.downloads.push(path);
   return {data:{arrayBuffer:async()=>image.buffer.slice(image.byteOffset,image.byteOffset+image.byteLength)},error:null};
  }})},
 } as unknown as SupabaseClient;
}
const load=(f:ReturnType<typeof fixture>)=>loadInvoicePdfContext({supabase:client(f),companyId:COMPANY,jobId:JOB,requirePod:true});
describe('Owner Driver exact-source PDF workflow — synthetic data only',()=>{
 it('renders a manual invoice as one A4 page',async()=>{
  const pdf=await PDFDocument.load(await buildInvoicePdf(base));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28,1);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89,1);
 });
 it('renders the invoice, official POD cover, handover and delivery image; can split PDF pages',async()=>{
  const f=fixture(),ctx=await load(f);
  expect(f.downloads).toEqual([PHOTO]);
  const combined=await PDFDocument.load(await buildInvoicePdf({...base,...ctx}));
  expect(combined.getPageCount()).toBe(4);
  const invoice=await PDFDocument.create(),pod=await PDFDocument.create();
  (await invoice.copyPages(combined,[0])).forEach(p=>invoice.addPage(p));
  (await pod.copyPages(combined,[1,2,3])).forEach(p=>pod.addPage(p));
  expect((await PDFDocument.load(await invoice.save())).getPageCount()).toBe(1);
  expect((await PDFDocument.load(await pod.save())).getPageCount()).toBe(3);
 });
 it('rejects foreign ownership and missing supplier agreement before evidence access',async()=>{
  const f=fixture();f.job.company_id=OTHER;
  await expect(load(f)).rejects.toThrow(/ownership/);
  f.job.exchange_visibility='exchange';f.agreement=false;
  await expect(load(f)).rejects.toThrow(/supplier agreement/);
  expect(f.downloads).toEqual([]);
 });
 it('rejects missing, rejected or merely typed-name POD before evidence access',async()=>{
  const f=fixture();f.job.delivery_photos=[];
  await expect(load(f)).rejects.toThrow(/Complete, non-rejected POD/);
  f.job.delivery_photos=[PHOTO];f.job.broker_pod_review_status='rejected';
  await expect(load(f)).rejects.toThrow(/Complete, non-rejected POD/);
  f.job.broker_pod_review_status='approved';f.job.delivery_signature_data={type:'recipient_typed_name_attestation',recipient_name:'Fixture Recipient',confirmed_at:'2026-11-18T12:00:00Z',job_id:JOB,evidence_path:PHOTO};
  await expect(load(f)).rejects.toThrow(/Complete, non-rejected POD/);
  expect(f.downloads).toEqual([]);
 });
 it('rejects mismatched recipient and out-of-tenant evidence storage path',async()=>{
  const f=fixture();f.pod.received_by='Different person';
  await expect(load(f)).rejects.toThrow(/handover metadata/);
  f.pod.received_by='Fixture Recipient';f.job.delivery_photos=[OTHER+'/'+JOB+'/file.png'];
  await expect(load(f)).rejects.toThrow(/does not belong/);
  expect(f.downloads).toEqual([]);
 });
});
