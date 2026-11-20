import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const h = vi.hoisted(() => ({
  job: {} as Record<string, unknown>, user: { id:'user-a' } as {id:string}|null,
  member: { id:'member-a' } as {id:string}|null, signer: vi.fn(),
}));
vi.mock('../app/api/_lib/supabaseAdmin', () => {
  const chain=(table:string)=>({select:()=>chain(table),eq:()=>chain(table),in:()=>chain(table),limit:()=>chain(table),maybeSingle:async()=>({data:table==='jobs'?h.job:h.member,error:null})});
  return {isSupabaseAdminConfigured:true, getBearerToken:(r:NextRequest)=>r.headers.get('authorization')?'synthetic':null,
    supabaseValidator:{auth:{getUser:async()=>({data:{user:h.user},error:null})}},
    supabaseAdmin:{from:chain,storage:{from:()=>({createSignedUrl:h.signer})}}};
});
import { GET } from '../app/api/pod/signed-url/route';

const path=(name:string)=>'company-a/job-a/'+name;
const request=(file:string,auth=true)=>new NextRequest('https://example.invalid/api/pod/signed-url?'+new URLSearchParams({jobId:'job-a',path:file}),{headers:auth?{authorization:'Bearer synthetic'}:{}});
beforeEach(()=>{
  h.user={id:'user-a'};h.member={id:'member-a'};
  h.job={id:'job-a',company_id:'company-a',assigned_company_id:'carrier-a',created_by:'other-user',
    pickup_photos:[path('collection-photos/pickup.jpg')],collection_photo_url:path('collection-photos/legacy.jpg'),
    delivery_photos:[path('photos/delivery.jpg')],damage_photos:[path('damage/damage.jpg')],pod_photos:[path('documents/pod.pdf')],
    delivery_signature_data:{evidence_path:path('signature/signature.png')}};
  h.signer.mockReset().mockResolvedValue({data:{signedUrl:'https://storage.example.invalid/signed'},error:null});
});
describe('XD-AUD-0017 POD signed evidence authority',()=>{
  it.each(['collection-photos/pickup.jpg','collection-photos/legacy.jpg','photos/delivery.jpg','damage/damage.jpg','documents/pod.pdf','signature/signature.png'])('signs linked scoped evidence %s',async name=>{
    const response=await GET(request(path(name)));expect(response.status).toBe(200);expect(h.signer).toHaveBeenCalledWith(path(name),120);expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('supports the executing carrier namespace',async()=>{const file='carrier-a/job-a/photos/delivery.jpg';h.job.delivery_photos=[file];expect((await GET(request(file))).status).toBe(200)});
  it('rejects an unauthenticated request',async()=>{expect((await GET(request(path('photos/delivery.jpg'),false))).status).toBe(401);expect(h.signer).not.toHaveBeenCalled()});
  it('rejects non-member even with a linked path',async()=>{h.member=null;expect((await GET(request(path('photos/delivery.jpg')))).status).toBe(403);expect(h.signer).not.toHaveBeenCalled()});
  it.each(['company-b/job-a/photos/delivery.jpg','company-a/job-b/photos/delivery.jpg','company-a/job-a/../photos/delivery.jpg','company-a/job-a/%2e%2e/delivery.jpg','https://example.invalid/f.jpg'])('rejects foreign or ambiguous linked path %s',async file=>{h.job.delivery_photos=[file];expect((await GET(request(file))).status).toBe(404);expect(h.signer).not.toHaveBeenCalled()});
  it('rejects an unlinked path within the correct tenant/job',async()=>{expect((await GET(request(path('photos/unlinked.jpg')))).status).toBe(404);expect(h.signer).not.toHaveBeenCalled()});
  it('returns controlled unavailable for missing object',async()=>{h.signer.mockResolvedValue({data:null,error:{message:'Object not found',statusCode:'404'}});const res=await GET(request(path('photos/delivery.jpg')));expect(res.status).toBe(404);expect(await res.json()).toEqual({error:'POD evidence file is unavailable.'})});
});
