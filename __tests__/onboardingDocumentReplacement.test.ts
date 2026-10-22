import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';

const state = vi.hoisted(() => ({
  user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } as { id: string } | null,
  apps: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', account_type: 'owner_driver', company_id: null, status: 'under_review', risk_status: 'clear', payload: {} }],
  documents: [] as Array<Record<string, unknown>>,
  duplicate: null as Record<string, unknown> | null,
  storeError: null as { code: string; message: string } | null,
  upload: vi.fn(), remove: vi.fn(), signed: vi.fn(), rpc: vi.fn(), queries: [] as Array<{ table: string; filters: unknown[][] }>,
}));
vi.mock('../app/api/_lib/supabaseAdmin', () => {
  const client = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: (table: string) => {
      const q = { table, filters: [] as unknown[][] }; state.queries.push(q);
      const value = () => table === 'onboarding_applications' ? state.apps
        : table === 'document_fingerprints' ? state.duplicate : state.documents;
      const chain: Record<string, unknown> = {};
      for (const method of ['select','eq','order','limit','in','filter']) {
        chain[method] = (...args: unknown[]) => { q.filters.push([method,...args]); return chain; };
      }
      chain.maybeSingle = async () => ({ data: table === 'onboarding_applications' ? state.apps[0] ?? null : value(), error: null });
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: value(), error: null }).then(resolve);
      return chain;
    },
    storage: { from: () => ({ upload: state.upload, remove: state.remove, createSignedUrl: state.signed }) },
    rpc: state.rpc,
  };
  return { isSupabaseAdminConfigured: true, supabaseAdmin: client, supabaseValidator: client,
    getBearerToken: (request: Request) => request.headers.get('authorization')?.replace('Bearer ','') ?? null };
});
import { GET, POST } from '../app/api/onboarding/documents/route';

function uploadRequest(docType='right_to_work', type='application/pdf', authorized=true) {
  const form = new FormData(); form.set('docType',docType);
  form.set('file',new File(['%PDF-1.7\nreplacement fixture'], 'corrected.pdf',{type}));
  return new NextRequest('https://example.test/api/onboarding/documents', { method:'POST', body:form,
    headers: authorized ? { Authorization:'Bearer test-token' } : {} });
}

beforeEach(() => {
  state.user={ id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  state.apps[0].risk_status='clear'; state.apps[0].status='under_review'; state.apps[0].account_type='owner_driver';
  state.documents=[]; state.duplicate=null; state.storeError=null; state.queries=[];
  state.upload.mockReset().mockResolvedValue({error:null}); state.remove.mockReset().mockResolvedValue({error:null});
  state.signed.mockReset().mockResolvedValue({data:{signedUrl:'https://storage.example.test/private-preview'},error:null});
  state.rpc.mockReset().mockImplementation(async () => ({ data:{ documentId:'new-document',replaced:true,application:{status:'under_review',completion_percentage:100}},error:state.storeError }));
});

describe('onboarding self-service replacement', () => {
  it('requires authentication before reading or uploading evidence', async () => {
    expect((await POST(uploadRequest('right_to_work','application/pdf',false))).status).toBe(401);
    expect((await GET(new NextRequest('https://example.test/api/onboarding/documents'))).status).toBe(401);
    expect(state.queries).toHaveLength(0); expect(state.upload).not.toHaveBeenCalled();
  });
  it('uses the authenticated applicant rather than an arbitrary document or company id', async () => {
    const response=await POST(uploadRequest()); expect(response.status).toBe(200);
    expect(state.queries.find(q=>q.table==='onboarding_applications')?.filters).toContainEqual(['eq','user_id',state.user!.id]);
    expect(state.rpc).toHaveBeenCalledWith('store_onboarding_document_revision',expect.objectContaining({
      p_application_id:state.apps[0].id,p_actor_user_id:state.user!.id,p_document_family:'identity',p_doc_type:'right_to_work',
    }));
  });
  it('returns the preserved pending review state and uploads to a fresh private object path', async () => {
    const response=await POST(uploadRequest()); const result=await response.json();
    expect(result.application.status).toBe('under_review'); expect(result.application.completion_percentage).toBe(100);
    expect(state.upload).toHaveBeenCalledWith(expect.stringMatching(/^aaaaaaaa-.*\/bbbbbbbb-.*\/[a-f0-9-]+-right_to_work\.pdf$/),expect.anything(),{contentType:'application/pdf',upsert:false});
  });
  it.each(['owner_driver','individual_driver','broker_shipper','fleet_courier'])('supports the canonical %s applicant', async accountType => {
    state.apps[0].account_type=accountType;
    const docType=['broker_shipper','fleet_courier'].includes(accountType)?'company_registration':'right_to_work';
    expect((await POST(uploadRequest(docType))).status).toBe(200);
  });
  it('does not permit rejected or fraud-blocked applicants to bypass review', async () => {
    state.apps[0].status='rejected'; expect((await POST(uploadRequest())).status).toBe(403);
    state.apps[0].status='under_review'; state.apps[0].risk_status='confirmed_fraud';
    expect((await POST(uploadRequest())).status).toBe(403); expect(state.upload).not.toHaveBeenCalled();
  });
  it('keeps exact-file duplicate detection without replacing any existing record', async () => {
    state.duplicate={ id:'fingerprint',onboarding_application_id:state.apps[0].id };
    expect((await POST(uploadRequest())).status).toBe(409); expect(state.upload).not.toHaveBeenCalled();
  });
  it('removes only the new storage object when the atomic transaction rejects a replacement', async () => {
    state.storeError={code:'42501',message:'Only the applicant can replace their documents.'};
    expect((await POST(uploadRequest())).status).toBe(403);
    expect(state.remove).toHaveBeenCalledWith([state.upload.mock.calls[0][0]]);
    expect(state.queries.every(q=>!q.filters.some(f=>f[0]==='delete'))).toBe(true);
  });
  it('does not disclose another applicant preview', async () => {
    state.documents=[{id:'mine',doc_type:'right_to_work',file_path:state.user!.id+'/'+state.apps[0].id+'/file.pdf'}];
    const response=await GET(new NextRequest('https://example.test/api/onboarding/documents?id=someone-else',{headers:{Authorization:'Bearer test-token'}}));
    expect(response.status).toBe(404); expect(state.signed).not.toHaveBeenCalled();
  });
  it('does not offer a preview for a placeholder with no uploaded file', async () => {
    state.documents=[{id:'empty',doc_type:'insurance',file_path:null}];
    const response=await GET(new NextRequest('https://example.test/api/onboarding/documents?id=empty',{headers:{Authorization:'Bearer test-token'}}));
    expect(response.status).toBe(409); expect(state.signed).not.toHaveBeenCalled();
  });
  it('returns metadata without exposing storage paths or signature tokens', async () => {
    state.documents=[{id:'mine',doc_type:'right_to_work',file_path:'private/path',verification_status:'unverified'}];
    const response=await GET(new NextRequest('https://example.test/api/onboarding/documents',{headers:{Authorization:'Bearer test-token'}}));
    const body=await response.json(); expect(body.documents[0].hasFile).toBe(true);
    expect(JSON.stringify(body)).not.toContain('private/path');
  });
  it('preserves evidence history and keeps verification in the server-only transaction', () => {
    const sql=readFileSync('supabase/migrations/20261020184144_atomic_onboarding_document_replacement.sql','utf8');
    expect(sql).toContain('FOR UPDATE'); expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('to_jsonb(d)'); expect(sql).toContain("'uploaded','unverified'");
    expect(sql).toContain('FROM PUBLIC, anon, authenticated'); expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).not.toContain('UPDATE public.profiles'); expect(sql).not.toContain("SET status='active'");
  });
});
