import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { buildCurrentLegalEvidence, buildCurrentLegalRequirement } from '../lib/legal/legalAgreementState';
import { getRegistrationLegalConfig, LEGAL_VERSION, PRIVACY_VERSION } from '../lib/legal/registrationAgreements';

const state = vi.hoisted(() => ({
  user: null as ({ user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown> } & Record<string, unknown>) | null,
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  writes: [] as Array<{ table: string; operation: string; value: unknown }>,
  queries: [] as Array<{ table: string; filters: unknown[][] }>,
  errorTable: '', persist: vi.fn(), rpc: vi.fn(),
}));
vi.mock('../lib/legal/persistSignedLegalAcceptance', () => ({ persistSignedLegalAcceptance: state.persist }));
vi.mock('../app/api/_lib/supabaseAdmin', () => {
  const client = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    rpc: state.rpc,
    from(table: string) {
      const filters: unknown[][] = []; state.queries.push({ table, filters });
      let resultOverride: Record<string, unknown> | undefined;
      const result = (single: boolean) => {
        const found = (state.tables[table] ?? []).filter(row => filters.every(([op,key,value]) =>
          op === 'eq' ? row[String(key)] === value : op === 'neq' ? row[String(key)] !== value : true));
        return { data: resultOverride ?? (single ? found[0] ?? null : found),
          error: table === state.errorTable ? { code: 'XX000', message: 'Database unavailable' } : null };
      };
      const chain = {
        select: () => chain, order: () => chain, limit: () => chain,
        eq: (k: string, v: unknown) => { filters.push(['eq',k,v]); return chain; },
        neq: (k: string, v: unknown) => { filters.push(['neq',k,v]); return chain; },
        insert: (value: unknown) => { state.writes.push({table,operation:'insert',value}); return chain; },
        upsert: (value: Record<string, unknown>) => { state.writes.push({table,operation:'upsert',value}); resultOverride={id:'new-app',...value}; return chain; },
        update: (value: unknown) => { state.writes.push({table,operation:'update',value}); return chain; },
        maybeSingle: async () => result(true), single: async () => result(true),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result(false)).then(resolve),
      }; return chain;
    },
  };
  return { isSupabaseAdminConfigured:true, supabaseAdmin:client, supabaseValidator:client,
    getBearerToken:(req:Request)=>req.headers.get('authorization')?.replace('Bearer ','')??null };
});
import { POST as init } from '../app/api/onboarding/init/route';
import { GET as legalGetRoute, POST as legalPostRoute } from '../app/api/account/legal-agreements/route';
async function requireResponse(promise: Promise<Response | undefined>): Promise<Response> {
  const response = await promise;
  if (!response) throw new Error('The legal endpoint must return an HTTP response.');
  return response;
}
const legalGet = (request: NextRequest) => requireResponse(legalGetRoute(request));
const legalPost = (request: NextRequest) => requireResponse(legalPostRoute(request));
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', appId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const roles = {owner_driver:'owner_operator',fleet_courier:'fleet_operator',broker_shipper:'transport_broker',customer_shipper:'customer_shipper'} as const;
const oldAt='2026-09-27T19:10:27.597Z';
function legacyMetadata(role='owner_operator') {
  return { requested_role:role, terms_accepted_at:oldAt, legal_agreements_accepted_at:oldAt,
    legal_agreement_codes:['platform_terms','owner_driver_terms','marketplace_transport_terms','membership_subscription_terms'],
    legal_agreement_versions:{platform_terms:'2026-09-01',owner_driver_terms:'2026-09-01',marketplace_transport_terms:'2026-09-01',membership_subscription_terms:'2026-09-01'},
    legal_authority_confirmed_at:oldAt,legal_role_declaration_confirmed_at:oldAt,
    privacy_acknowledged_at:oldAt,privacy_version:'2026-09-01' };
}
const req=(url:string,body:unknown={},authorized=true)=>new NextRequest('https://example.test'+url,{method:'POST',
  headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer test'}:{})},body:JSON.stringify(body)});
const getReq=()=>new NextRequest('https://example.test/api/account/legal-agreements',{headers:{Authorization:'Bearer test'}});
const validAcceptance=(role:keyof typeof roles='owner_driver')=>({requirementFingerprint:buildCurrentLegalRequirement(roles[role],'en').requirementFingerprint,
  agreementsAccepted:true,authorityConfirmed:true,roleDeclarationConfirmed:true,privacyAcknowledged:true,
  languageComprehensionConfirmed:true,language:'en',signerFullName:'Synthetic Legacy Applicant'});
function storedEvidence(evidence:ReturnType<typeof buildCurrentLegalEvidence>) {
  return {id:'current-evidence',user_id:actor,registration_role:evidence.registrationRole,legal_version:evidence.legalVersion,
    agreements:evidence.agreements,privacy_version:evidence.privacyVersion,acceptance_language:evidence.acceptanceLanguage,
    acceptance_statement:evidence.acceptanceStatement,privacy_document_hash:evidence.privacyDocumentHash,
    accepted_at:evidence.acceptedAt,created_at:evidence.acceptedAt,source:'material_reacceptance',evidence_hash:evidence.evidenceHash};
}
beforeEach(()=>{
  state.user={id:actor,email:'synthetic@example.test',user_metadata:legacyMetadata(),app_metadata:{}};
  state.tables={profiles:[{user_id:actor,status:'pending'}],onboarding_applications:[{id:appId,user_id:actor,status:'in_progress',
    account_type:'owner_driver',company_id:null,created_at:oldAt,current_step:'document_upload',completion_percentage:60,
    token_hash:'retained',token_expires_at:oldAt,token_activated_at:null,payload:{full_name:'Synthetic Legacy Applicant',doc_driving_licence:'retained/file.pdf'}}],
    registration_legal_acceptances:[{id:'old-evidence',user_id:actor,onboarding_application_id:appId,registration_role:'owner_operator',
      legal_version:'2026-09-04',privacy_version:'2026-09-01',agreements:[{code:'platform_terms',version:'2026-09-01'}],
      accepted_at:oldAt,created_at:oldAt,source:'registration',evidence_hash:'old-immutable-evidence'}]};
  state.writes=[];state.queries=[];state.errorTable='';state.rpc.mockReset().mockResolvedValue({data:null,error:null});
  state.persist.mockReset().mockImplementation(async input=>({data:storedEvidence(input.evidence),error:null}));
});

describe('legacy applicant resume - no retroactive consent',()=>{
  it.each(Object.keys(roles))('resumes saved %s without recreating consent or rotating invitations',async type=>{
    state.tables.onboarding_applications[0].account_type=type;
    const before=JSON.stringify(state.tables);
    const response=await init(req('/api/onboarding/init',{resumeOnly:true}));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({onboardingApplicationId:appId,
      accountType:type,resumeAllowed:true,invitationRegenerated:false,legalEvidenceRecorded:false,status:'in_progress'});
    expect(state.writes).toEqual([]); expect(state.persist).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalled();
    expect(JSON.stringify(state.tables)).toBe(before); expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('also fixes callback/older clients without a resumeOnly field',async()=>{
    expect((await init(req('/api/onboarding/init'))).status).toBe(200); expect(state.writes).toEqual([]);
  });
  it.each(['draft','invited','in_progress','request_changes','under_review','approved','rejected'])('does not rewrite %s applications',async status=>{
    state.tables.onboarding_applications[0].status=status;
    const response=await init(req('/api/onboarding/init',{resumeOnly:true})); expect(response.status).toBe(200);
    expect((await response.json()).status).toBe(status);expect(state.writes).toEqual([]);
  });
  it('does not take the saved role from editable authentication metadata',async()=>{
    state.user!.user_metadata.requested_role='customer_shipper';
    expect((await (await init(req('/api/onboarding/init'))).json()).accountType).toBe('owner_driver');
  });
  it('preserves valid company-driver invitation authority without assigning commercial terms',async()=>{
    Object.assign(state.tables.onboarding_applications[0],{account_type:'individual_driver',company_id:'company',payload:{canonical_account_type:'company_driver'}});
    const response=await init(req('/api/onboarding/init',{resumeOnly:true}));expect(response.status).toBe(200);
    expect((await response.json()).accountType).toBe('individual_driver');expect(state.persist).not.toHaveBeenCalled();
  });
  it('rejects a new registration with stale/incomplete legal metadata even with resumeOnly=true',async()=>{
    state.tables.onboarding_applications=[];
    const response=await init(req('/api/onboarding/init',{resumeOnly:true}));expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('invalid_registration_legal_evidence');expect(state.writes).toEqual([]);
  });
  it('allows a genuinely current new registration to retain its original signed evidence flow',async()=>{
    state.tables.onboarding_applications=[];const config=getRegistrationLegalConfig('owner_operator');
    state.user!.user_metadata={...legacyMetadata(),legal_version:LEGAL_VERSION,privacy_version:PRIVACY_VERSION,
      legal_agreement_versions:Object.fromEntries(config.agreements.map(a=>[a.code,a.version])),
      legal_language_comprehension_confirmed_at:oldAt,legal_acceptance_language:'en',legal_signer_full_name:'Synthetic Signer'};
    const response=await init(req('/api/onboarding/init'));expect(response.status).toBe(200);
    expect(state.persist).toHaveBeenCalledWith(expect.objectContaining({userId:actor,onboardingApplicationId:'new-app',source:'registration'}));
  });
  it.each(['suspended','blocked','rejected','inactive','unknown'])('does not convert a %s profile into pending',async status=>{
    state.tables.profiles[0].status=status;expect((await init(req('/api/onboarding/init',{resumeOnly:true}))).status).toBe(403);
    expect(state.writes).toEqual([]);
  });
  it('requires a verified session',async()=>{expect((await init(req('/api/onboarding/init',{},false))).status).toBe(401);expect(state.queries).toEqual([]);});
  it('fails closed on duplicate applications and database failures',async()=>{
    state.tables.onboarding_applications.push({...state.tables.onboarding_applications[0],id:'second'});
    expect((await init(req('/api/onboarding/init'))).status).toBe(409);state.tables.onboarding_applications.pop();
    state.errorTable='onboarding_applications';expect((await init(req('/api/onboarding/init'))).status).toBe(500);
    expect(state.writes).toEqual([]);
  });
});

describe('explicit current reacceptance remains tied to the canonical application',()=>{
  it('shows historical consent as superseded and requires deliberate reacceptance',async()=>{
    const response=await legalGet(getReq());expect(response.status).toBe(200);const body=await response.json();
    expect(body.requiresReacceptance).toBe(true);expect(body.context.onboardingApplicationId).toBe(appId);
    expect(body.history[0]).toMatchObject({id:'old-evidence',acceptedAt:oldAt,status:'superseded'});
    expect(state.persist).not.toHaveBeenCalled();expect(state.writes).toEqual([]);
  });
  it.each(Object.keys(roles) as Array<keyof typeof roles>)('binds new explicit %s reacceptance without overwriting history',async type=>{
    state.tables.onboarding_applications[0].account_type=type;
    state.tables.registration_legal_acceptances[0].registration_role=roles[type];
    const old=JSON.stringify(state.tables.registration_legal_acceptances);
    const response=await legalPost(req('/api/account/legal-agreements',validAcceptance(type)));expect(response.status).toBe(201);
    expect(state.persist).toHaveBeenCalledWith(expect.objectContaining({userId:actor,onboardingApplicationId:appId,companyId:null,
      source:'material_reacceptance',signerFullName:'Synthetic Legacy Applicant',evidence:expect.objectContaining({legalVersion:LEGAL_VERSION})}));
    expect(JSON.stringify(state.tables.registration_legal_acceptances)).toBe(old);expect(state.writes).toEqual([]);
    const input=state.persist.mock.calls[0][0];expect(Date.parse(input.evidence.acceptedAt)).toBeGreaterThan(Date.parse(oldAt));
  });
  it.each(['agreementsAccepted','authorityConfirmed','roleDeclarationConfirmed','privacyAcknowledged','languageComprehensionConfirmed'])('rejects missing %s',async field=>{
    const body:Record<string,unknown>=validAcceptance();delete body[field];
    expect((await legalPost(req('/api/account/legal-agreements',body))).status).toBe(400);expect(state.persist).not.toHaveBeenCalled();
  });
  it('rejects an outdated requirement fingerprint',async()=>{
    const response=await legalPost(req('/api/account/legal-agreements',{...validAcceptance(),requirementFingerprint:'0'.repeat(64)}));
    expect(response.status).toBe(409);expect((await response.json()).code).toBe('legal_requirement_stale');expect(state.persist).not.toHaveBeenCalled();
  });
  it('does not force a second signature after current reacceptance merely because signup metadata stayed old',async()=>{
    state.tables.registration_legal_acceptances.unshift(storedEvidence(buildCurrentLegalEvidence('owner_operator',new Date().toISOString(),'en')));
    expect((await (await legalGet(getReq())).json()).requiresReacceptance).toBe(false);
    expect((await init(req('/api/onboarding/init',{resumeOnly:true}))).status).toBe(200);expect(state.persist).not.toHaveBeenCalled();
  });
  it('ignores a posted foreign application/company identifier when recording consent',async()=>{
    expect((await legalPost(req('/api/account/legal-agreements',{...validAcceptance(),onboardingApplicationId:'foreign',companyId:'foreign'}))).status).toBe(201);
    expect(state.persist.mock.calls[0][0]).toMatchObject({onboardingApplicationId:appId,companyId:null,userId:actor});
  });
});
