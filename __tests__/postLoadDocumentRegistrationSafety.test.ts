import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const COMPANY='11111111-1111-4111-8111-111111111111';
const JOB='job-synthetic';
const PATH=COMPANY+'/'+JOB+'/test.pdf';
const h=vi.hoisted(()=>({download:vi.fn(),remove:vi.fn(),insert:vi.fn(),existing:vi.fn(),capability:vi.fn()}));
vi.mock('../app/api/admin/_lib/requireCompanyCapability',()=>({
 requireCompanyCapability:h.capability,isCompanyCapabilityContext:(v:unknown)=>!(v instanceof Response),
}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({
 isSupabaseAdminConfigured:true,
 supabaseAdmin:{
  storage:{from:()=>({download:h.download,remove:h.remove})},
  from:(_table:string)=>{
   const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:{id:'job-synthetic'},error:null}),in:h.existing,insert:(rows:unknown)=>({select:()=>h.insert(rows)})};
   return chain;
  },
 },
}));
import { POST } from '../app/api/admin/jobs/[id]/documents/route';
const doc=(size=1,path=PATH)=>({storagePath:path,fileName:'test.pdf',fileSizeBytes:size,mimeType:'application/pdf'});
const call=(documents:ReturnType<typeof doc>[])=>POST(new NextRequest('https://example.invalid/api/admin/jobs/'+JOB+'/documents',{method:'POST',body:JSON.stringify({companyId:COMPANY,documents})}),{params:Promise.resolve({id:JOB})});
beforeEach(()=>{
 h.capability.mockReset().mockResolvedValue({companyId:COMPANY,userId:'synthetic-user',roleInCompany:'admin'});
 h.download.mockReset().mockResolvedValue({data:new Blob(['a'],{type:'application/pdf'}),error:null});
 h.remove.mockReset().mockResolvedValue({error:null});
 h.existing.mockReset().mockResolvedValue({data:[],error:null});
 h.insert.mockReset().mockResolvedValue({data:[{id:'synthetic-doc'}],error:null});
});
describe('Post Load document registration cannot delete stored data',()=>{
 it('rejects foreign namespaces without touching storage',async()=>{
  expect((await call([doc(1,'other-company/other-job/test.pdf')])).status).toBe(400);
  expect(h.download).not.toHaveBeenCalled();expect(h.remove).not.toHaveBeenCalled();expect(h.insert).not.toHaveBeenCalled();
 });
 it('validates all paths before even reading the first object',async()=>{
  expect((await call([doc(),doc(1,'foreign/job/test.pdf')])).status).toBe(400);
  expect(h.download).not.toHaveBeenCalled();expect(h.remove).not.toHaveBeenCalled();
 });
 it('preserves existing evidence after mismatched metadata',async()=>{
  expect((await call([doc(2)])).status).toBe(409);
  expect(h.remove).not.toHaveBeenCalled();expect(h.insert).not.toHaveBeenCalled();
 });
 it('preserves files if registration fails or might have committed',async()=>{
  h.insert.mockResolvedValue({data:null,error:{code:'synthetic',message:'synthetic error'}});
  expect((await call([doc()])).status).toBe(500);
  expect(h.remove).not.toHaveBeenCalled();
 });
 it('preserves data if checking existing metadata fails',async()=>{
  h.existing.mockResolvedValue({data:null,error:{message:'synthetic error'}});
  expect((await call([doc()])).status).toBe(500);
  expect(h.remove).not.toHaveBeenCalled();
 });
 it('accepts a valid upload and keeps repeated registration idempotent',async()=>{
  expect((await call([doc()])).status).toBe(201);
  h.existing.mockResolvedValue({data:[{id:'synthetic-doc',file_path:PATH}],error:null});
  expect((await call([doc()])).status).toBe(200);
  expect(h.insert).toHaveBeenCalledTimes(1);expect(h.remove).not.toHaveBeenCalled();
 });
 it('accepts exactly 20 MiB and rejects larger metadata and too many files',async()=>{
  h.download.mockResolvedValue({data:new Blob([new Uint8Array(20*1024*1024)],{type:'application/pdf'}),error:null});
  expect((await call([doc(20*1024*1024)])).status).toBe(201);
  h.download.mockClear();
  expect((await call([doc(20*1024*1024+1)])).status).toBe(400);
  expect((await call(Array.from({length:13},()=>doc()))).status).toBe(400);
  expect(h.download).not.toHaveBeenCalled();expect(h.remove).not.toHaveBeenCalled();
 });
 it('rejects unauthorized requests without reading or deleting storage',async()=>{
  h.capability.mockResolvedValue(NextResponse.json({error:'Forbidden'},{status:403}));
  expect((await call([doc()])).status).toBe(403);
  expect(h.download).not.toHaveBeenCalled();expect(h.remove).not.toHaveBeenCalled();
 });
});
