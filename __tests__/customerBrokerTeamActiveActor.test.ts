import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const company='00000000-0000-4000-8000-000000000001';
const member='00000000-0000-4000-8000-000000000002';
const h=vi.hoisted(()=>({
 profileStatus:'active' as string|null, companyStatus:'active', profileError:false,
 actorRole:'admin', membershipStatus:'active', calls:[] as string[],
 rpc:vi.fn(), invite:vi.fn(), listUsers:vi.fn(), write:vi.fn(),
}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({
 isSupabaseAdminConfigured:true,getBearerToken:()=> 'fixture',
 supabaseValidator:{auth:{getUser:async()=>({data:{user:{id:'actor'}},error:null})}},
 supabaseAdmin:{auth:{admin:{inviteUserByEmail:h.invite,listUsers:h.listUsers},signInWithOtp:h.invite},
 rpc:h.rpc,
 from:(table:string)=>{
  h.calls.push(table);const f:Record<string,unknown>={};
  const q={select:()=>q,eq:(k:string,v:unknown)=>{f[k]=v;return q},limit:()=>q,order:()=>q,
   update:(v:unknown)=>{h.write(v);return q},delete:()=>{h.write('delete');return q},
   then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(resolve),
   maybeSingle:async()=>{
    if(table==='profiles')return {data:h.profileStatus===null?null:{role:'customer',status:h.profileStatus},error:h.profileError?{message:'fixture'}:null};
    if(table==='company_memberships'&&f.user_id==='actor')return {data:f['companies.status']&&f['companies.status']!==h.companyStatus?null:{id:'actor-member',role_in_company:h.actorRole,status:h.membershipStatus},error:null};
    if(table==='company_memberships'&&f.id)return {data:{id:f.id,user_id:'other',role_in_company:'viewer',status:'active'},error:null};
    return {data:null,error:null};
   }};
  return q;
 }},
}));
import {GET,POST,PATCH} from '../app/api/customer/team/route';
async function requireResponse(pending: Promise<Response | undefined>): Promise<Response> {
 const response = await pending;
 if (!response) throw Error('Route did not return an HTTP response');
 return response;
}
const get=()=>requireResponse(GET(new NextRequest('https://example.invalid/api/customer/team?companyId='+company)));
const post=()=>requireResponse(POST(new NextRequest('https://example.invalid/api/customer/team',{method:'POST',body:JSON.stringify({companyId:company,email:'fixture@example.invalid',workspace:'customer',role:'viewer'})})));
const patch=()=>requireResponse(PATCH(new NextRequest('https://example.invalid/api/customer/team',{method:'PATCH',body:JSON.stringify({companyId:company,membershipId:member,action:'department',departmentId:null})})));
beforeEach(()=>{Object.assign(h,{profileStatus:'active',companyStatus:'active',profileError:false,actorRole:'admin',membershipStatus:'active'});h.calls.length=0;h.invite.mockReset().mockResolvedValue({data:{user:null},error:{message:'fixture'}});h.listUsers.mockReset().mockResolvedValue({data:{users:[]},error:null});h.rpc.mockReset().mockReturnValue({maybeSingle:async()=>({data:{id:member},error:null})});h.write.mockReset();});
describe('customer and broker team actor authority',()=>{
 it.each(['suspended','pending','rejected',null])('denies all team endpoints for nonactive or missing profile %s',async state=>{
  h.profileStatus=state;for(const fn of [get,post,patch])expect((await fn()).status).toBe(403);
  expect(h.invite).not.toHaveBeenCalled();expect(h.rpc).not.toHaveBeenCalled();expect(h.write).not.toHaveBeenCalled();
 });
 it('fails closed on profile lookup failure',async()=>{h.profileError=true;for(const fn of [get,post,patch])expect((await fn()).status).toBe(500);expect(h.invite).not.toHaveBeenCalled();expect(h.rpc).not.toHaveBeenCalled();});
 it('denies a suspended company even with an active owner or admin',async()=>{h.companyStatus='suspended';for(const fn of [get,post,patch])expect((await fn()).status).toBe(403);expect(h.invite).not.toHaveBeenCalled();expect(h.rpc).not.toHaveBeenCalled();});
 it('preserves active owner/admin team read and authorized department RPC',async()=>{expect((await get()).status).toBe(200);expect((await patch()).status).toBe(200);expect(h.rpc).toHaveBeenCalledExactlyOnceWith('assign_company_membership_department',{p_company_id:company,p_actor_user_id:'actor',p_membership_id:member,p_department_id:null});});
 it('preserves active viewer read but never allows invite or department changes',async()=>{h.actorRole='viewer';const r=await get();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({canManageTeam:false});expect((await post()).status).toBe(403);expect((await patch()).status).toBe(403);expect(h.invite).not.toHaveBeenCalled();expect(h.rpc).not.toHaveBeenCalled();});
 it('denies disabled membership even with active profile',async()=>{h.membershipStatus='disabled';for(const fn of [get,post,patch])expect((await fn()).status).toBe(403);});
});
