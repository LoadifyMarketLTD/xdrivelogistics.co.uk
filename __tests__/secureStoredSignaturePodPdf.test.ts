import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { writeFileSync } from 'node:fs';

const h = vi.hoisted(()=>({
  job:{} as Record<string,unknown>, user:{id:'user-a'} as {id:string}|null,
  member:{id:'member-a'} as {id:string}|null, download:vi.fn(),
}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>{
  const chain=(table:string)=>({select:()=>chain(table),eq:()=>chain(table),in:()=>chain(table),limit:()=>chain(table),
    maybeSingle:async()=>({data:table==='jobs'?h.job:table==='companies'?{name:'Synthetic Carrier'}:h.member,error:null})});
  return {getBearerToken:(r:NextRequest)=>r.headers.get('authorization')?'synthetic':null,
    isSupabaseAdminConfigured:true,supabaseValidator:{auth:{getUser:async()=>({data:{user:h.user},error:null})}},
    supabaseAdmin:{from:chain,storage:{from:()=>({download:h.download})}}};
});
vi.mock('../lib/server/reserveMultiStopPod',()=>({loadReserveStopAppendix:async()=>null}));
import { GET } from '../app/api/workspace/jobs/[jobId]/pod/pdf/route';

const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xl2sAAAAASUVORK5CYII=';
const png=Buffer.from(image,'base64');
const inline='data:image/png;base64,'+image;
const signature='carrier-a/job-a/signature/drawn.png';
const photo='carrier-a/job-a/photos/delivery.png';
const file=()=>new Blob([new Uint8Array(png)],{type:'image/png'});
const call=(auth=true)=>GET(new NextRequest('https://example.invalid/api/workspace/jobs/job-a/pod/pdf',{headers:auth?{Authorization:'Bearer synthetic'}:{}}),{params:Promise.resolve({jobId:'job-a'})});
beforeEach(()=>{
 h.user={id:'user-a'};h.member={id:'member-a'};
 h.job={id:'job-a',company_id:'company-a',assigned_company_id:'carrier-a',created_by:'other-user',pod_generated:true,delivery_photos:[photo],client_signature_name:'Synthetic Receiver',delivery_signature_data:inline};
 h.download.mockReset().mockResolvedValue({data:file(),error:null});
});
async function validPdf(response:Response){
 expect(response.status).toBe(200);
 expect(response.headers.get('content-type')).toBe('application/pdf');
 expect(response.headers.get('cache-control')).toBe('private, no-store');
 const bytes=new Uint8Array(await response.arrayBuffer());
 expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
 return bytes;
}
describe('XD-AUD-0019 secure stored signature PDF',()=>{
 it('retains inline image PDF generation',async()=>{const bytes=await validPdf(await call());expect(h.download.mock.calls).toEqual([[photo]]);if(process.env.POD_AUDIT_SAMPLE_DIR)writeFileSync(process.env.POD_AUDIT_SAMPLE_DIR+'/XD-AUD-0019-inline.pdf',bytes)});
 it.each([signature,{value:signature},{signature_data:signature}])('loads only the scoped stored signature',async(value)=>{h.job.delivery_signature_data=value;const bytes=await validPdf(await call());expect(h.download.mock.calls).toEqual([[signature],[photo]]);if(typeof value==='string'&&process.env.POD_AUDIT_SAMPLE_DIR)writeFileSync(process.env.POD_AUDIT_SAMPLE_DIR+'/XD-AUD-0019-stored.pdf',bytes)});
 it('supports historical inline signature_data',async()=>{h.job.delivery_signature_data={signature_data:inline};await validPdf(await call());expect(h.download.mock.calls).toEqual([[photo]])});
 it('rejects typed attestation even with an image',async()=>{h.job.delivery_signature_data={type:'recipient_typed_name_attestation',signature_data:signature};expect((await call()).status).toBe(409);expect(h.download).not.toHaveBeenCalled()});
 it('rejects unknown evidence_path object without drawn signature metadata',async()=>{h.job.delivery_signature_data={evidence_path:signature};expect((await call()).status).toBe(409);expect(h.download).not.toHaveBeenCalled()});
 it.each(['foreign/job-a/signature/drawn.png','carrier-a/job-b/signature/drawn.png','carrier-a/job-a/../signature.png','carrier-a/job-a/%2e%2e/signature.png','https://external.invalid/path/signature.png'])('rejects unsafe paths before download',async(p)=>{h.job.delivery_signature_data=p;expect((await call()).status).toBe(409);expect(h.download).not.toHaveBeenCalled()});
 it('fails closed for a missing stored signature',async()=>{h.job.delivery_signature_data=signature;h.download.mockResolvedValue({data:null,error:{message:'private storage error'}});const res=await call();expect(res.status).toBe(409);expect(await res.json()).toEqual({error:'Stored recipient signature is unavailable.'});expect(h.download.mock.calls).toEqual([[signature]])});
 it('rejects non-image content',async()=>{h.job.delivery_signature_data=signature;h.download.mockResolvedValue({data:new Blob(['invalid'],{type:'image/png'}),error:null});expect((await call()).status).toBe(409);expect(h.download.mock.calls).toEqual([[signature]])});
 it('rejects anonymous and foreign-company callers before fetching evidence',async()=>{h.job.delivery_signature_data=signature;expect((await call(false)).status).toBe(401);h.member=null;expect((await call()).status).toBe(403);expect(h.download).not.toHaveBeenCalled()});

 it('accepts matching JPEG bytes rather than trusting MIME alone',async()=>{
  const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKABQDASIAAhEBAxEB/8QAGQAAAQUAAAAAAAAAAAAAAAAAAAMEBQcI/8QAJhAAAgEDAwQBBQAAAAAAAAAAAQIDBAUSABEhBhMiQRUIMTd1s//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCz6+uulReKm826SeS22TOF6KBcjcTiTOFHIZkIjCbbHuJNG2wbISFfX/NyxWm01fjLFDV1NZBJsEpXY7BGXktKEdQykYjJ8gQgc6F8ugen5TzJNb4J5XP3kkdA7ux9szMzEnkkknk6T6IghgsVSIYo4x8nXJsigeMdTJFGOPSxxogHpUUDgAaB503XVFVbpKWvk7lyt8ppKt8QO46gFZNhwO4jRyYjfHPHfdTo1nj6jvyHb/1Uf9ZdGg//2Q==','base64');
  const jpg=signature.replace('.png','.jpg');
  h.job.delivery_signature_data=jpg;
  h.download.mockImplementation(async p=>({data:p===jpg?new Blob([new Uint8Array(jpeg)],{type:'image/jpeg'}):file(),error:null}));
  await validPdf(await call());expect(h.download.mock.calls).toEqual([[jpg],[photo]]);
 });
 it('rejects an extension and image-byte mismatch',async()=>{h.job.delivery_signature_data=signature.replace('.png','.jpg');expect((await call()).status).toBe(409);expect(h.download).toHaveBeenCalledTimes(1)});
 it('rejects oversized stored image before processing',async()=>{h.job.delivery_signature_data=signature;h.download.mockResolvedValue({data:new Blob([new Uint8Array(10*1024*1024+1)]),error:null});expect((await call()).status).toBe(409);expect(h.download).toHaveBeenCalledTimes(1)});
 it('handles transient storage exceptions without leaking internals',async()=>{h.job.delivery_signature_data=signature;h.download.mockRejectedValue(new Error('private detail'));const r=await call();expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'Stored recipient signature could not be retrieved. Please retry.'})});
});
