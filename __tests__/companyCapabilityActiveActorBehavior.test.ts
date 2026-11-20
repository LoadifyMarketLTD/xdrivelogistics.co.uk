import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { WorkspaceCapability } from '../lib/workspaceRole';

const h = vi.hoisted(() => ({
  profile: {status:'active'} as {status:string|null}|null,
  profileError: false,
  membership: {id:'membership-a',company_id:'company-a',role_in_company:'admin'} as {id:string,company_id:string,role_in_company:string}|null,
  memberError: false,
  user: {id:'user-a'} as {id:string}|null,
  queries: [] as {table:string,field:string,value:unknown}[],
}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({
 isSupabaseAdminConfigured:true,
 getBearerToken:(r:NextRequest)=>r.headers.has('authorization')?'synthetic':null,
 supabaseValidator:{auth:{getUser:async()=>({data:{user:h.user},error:null})}},
 supabaseAdmin:{from:(table:string)=>{
  const chain={select:()=>chain,eq:(field:string,value:unknown)=>{h.queries.push({table,field,value});return chain},limit:()=>chain,
    maybeSingle:async()=>table==='profiles'?{data:h.profile,error:h.profileError?{message:'synthetic'}:null}:{data:h.membership,error:h.memberError?{message:'synthetic'}:null}};
  return chain;
 }},
}));
import { requireCompanyCapability } from '../app/api/admin/_lib/requireCompanyCapability';

const request=(auth=true)=>new NextRequest('https://example.invalid',{headers:auth?{Authorization:'Bearer synthetic'}:{}});
const call=(cap:WorkspaceCapability='quotes.award',company='company-a',auth=true)=>requireCompanyCapability(request(auth),company,cap);
const status=(r:Awaited<ReturnType<typeof call>>)=>r instanceof NextResponse?r.status:200;
beforeEach(()=>{h.profile={status:'active'};h.profileError=false;h.membership={id:'membership-a',company_id:'company-a',role_in_company:'admin'};h.memberError=false;h.user={id:'user-a'};h.queries.length=0;});
describe('company API active actor authority',()=>{
 it.each(['pending','suspended','rejected','disabled',null])('denies non-active profile %s even with active admin membership',async state=>{
  h.profile={status:state};expect(status(await call())).toBe(403);
  expect(h.queries.some(q=>q.table==='company_memberships')).toBe(false);
 });
 it('denies missing profile',async()=>{h.profile=null;expect(status(await call())).toBe(403)});
 it('fails closed on profile lookup error',async()=>{h.profileError=true;expect(status(await call())).toBe(500)});
 it('retains active authorized membership and binds query to actor and tenant',async()=>{
  expect(await call()).toMatchObject({userId:'user-a',companyId:'company-a',membershipId:'membership-a',workspaceRole:'company_admin'});
  expect(h.queries).toEqual(expect.arrayContaining([
   {table:'profiles',field:'user_id',value:'user-a'},
   {table:'company_memberships',field:'user_id',value:'user-a'},
   {table:'company_memberships',field:'company_id',value:'company-a'},
   {table:'company_memberships',field:'status',value:'active'},
   {table:'company_memberships',field:'companies.status',value:'active'},
  ]));
 });
 it.each(['viewer','member','finance','compliance'])('does not grant commercial award to %s',async role=>{
  h.membership!.role_in_company=role;expect(status(await call())).toBe(403);
 });
 it('denies nonexistent requested tenant membership',async()=>{h.membership=null;expect(status(await call('quotes.award','company-b'))).toBe(403)});
 it('denies anonymous requests without database lookups',async()=>{expect(status(await call('quotes.award','company-a',false))).toBe(401);expect(h.queries).toEqual([])});
 it('denies missing authenticated identity',async()=>{h.user=null;expect(status(await call())).toBe(401);expect(h.queries).toEqual([])});
});
