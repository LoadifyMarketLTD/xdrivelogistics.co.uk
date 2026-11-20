import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const h=vi.hoisted(()=>({
 actorStatus:'active',actorRole:'admin',actorCompany:'company-a',targetRole:'dispatcher',targetCompany:'company-a',targetStatus:'active',
 existing:true,invite:vi.fn(),updateUser:vi.fn(),upsert:vi.fn(),reset:vi.fn(),create:vi.fn(),lookup:vi.fn(),
}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({
 isSupabaseAdminConfigured:true,getBearerToken:()=> 'fixture',supabaseValidator:{auth:{getUser:async()=>({data:{user:{id:'actor'}},error:null})}},
 supabaseAdmin:{auth:{admin:{inviteUserByEmail:h.invite,updateUserById:h.updateUser,createUser:h.create,listUsers:h.lookup},resetPasswordForEmail:h.reset},
 from:(table:string)=>{
  const filters:Record<string,unknown>={};const q={select:()=>q,eq:(k:string,v:unknown)=>{filters[k]=v;return q},in:()=>q,limit:()=>q,upsert:(v:unknown)=>{h.upsert(v);return Object.assign(q,{then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({error:null}).then(resolve)})},maybeSingle:async()=>{
   if(table==='profiles')return {data:filters.user_id==='actor'?{status:h.actorStatus}:{role:'company_staff',company_id:h.targetCompany,status:h.targetStatus,is_driver:false},error:null};
   if(table==='company_memberships'&&filters.user_id==='actor')return {data:(!filters.company_id||filters.company_id===h.actorCompany)&&(!filters.id||filters.id==='actor-membership')&&['owner','admin'].includes(h.actorRole)?{id:'actor-membership',company_id:h.actorCompany,role_in_company:h.actorRole}:null,error:null};
   if(table==='company_memberships')return {data:(!filters.company_id||filters.company_id===h.targetCompany)&&(!filters.role_in_company||filters.role_in_company===h.targetRole)&&(!filters.status||filters.status===h.targetStatus)?{id:'target-membership',company_id:h.targetCompany,role_in_company:h.targetRole,status:h.targetStatus,user_id:'target'}:null,error:null};
   return {data:null,error:null};
  }};return q;
 }},
}));
import { POST, PATCH } from '../app/api/admin/dispatchers/route';
const req=(method:string,body:Record<string,unknown>={})=>new NextRequest('https://example.invalid/api/admin/dispatchers',{method,body:JSON.stringify({companyId:'company-a',membershipId:'actor-membership',displayName:'Synthetic',email:'target@example.invalid',...body})});
beforeEach(()=>{
 Object.assign(h,{actorStatus:'active',actorRole:'admin',actorCompany:'company-a',targetRole:'dispatcher',targetCompany:'company-a',targetStatus:'active',existing:true});
 h.invite.mockReset().mockResolvedValue({data:{user:null},error:{message:'already registered',code:'email_exists'}});
 h.lookup.mockReset().mockResolvedValue({data:{users:[{id:'target',email:'target@example.invalid'}]},error:null});
 h.updateUser.mockReset().mockResolvedValue({error:null});h.upsert.mockReset();h.reset.mockReset().mockResolvedValue({error:null});h.create.mockReset();
});
describe('dispatcher account assignment authority',()=>{
 it.each(['suspended','pending','rejected'])('denies %s actor before inviting or resetting',async status=>{
  h.actorStatus=status;expect((await POST(req('POST'))).status).toBe(403);expect((await PATCH(req('PATCH'))).status).toBe(403);expect(h.invite).not.toHaveBeenCalled();expect(h.reset).not.toHaveBeenCalled();
 });
 it('binds the requested tenant instead of silently operating in another company',async()=>{
  expect((await POST(req('POST',{companyId:'company-b'}))).status).toBe(403);expect((await PATCH(req('PATCH',{companyId:'company-b'}))).status).toBe(403);expect(h.invite).not.toHaveBeenCalled();expect(h.reset).not.toHaveBeenCalled();
 });
 it('binds an explicitly supplied membership ID',async()=>{
  expect((await POST(req('POST',{membershipId:'foreign-membership'}))).status).toBe(403);expect(h.invite).not.toHaveBeenCalled();
 });
 it.each(['owner','admin','member','viewer','fleet_manager'])('does not overwrite an existing %s membership',async role=>{
  h.targetRole=role;expect((await POST(req('POST'))).status).toBe(409);expect(h.updateUser).not.toHaveBeenCalled();expect(h.upsert).not.toHaveBeenCalled();
 });
 it('does not take over an existing account from another tenant',async()=>{
  h.targetCompany='company-b';expect((await POST(req('POST'))).status).toBe(409);expect(h.updateUser).not.toHaveBeenCalled();expect(h.upsert).not.toHaveBeenCalled();
 });
 it('keeps existing same-company dispatcher password setup available without rewriting profile or membership',async()=>{
  const r=await POST(req('POST'));expect(r.status).toBe(200);expect(await r.json()).toMatchObject({onboardingOutcome:'password_setup_required',temporaryPassword:null});expect(h.updateUser).not.toHaveBeenCalled();expect(h.upsert).not.toHaveBeenCalled();
 });
 it('preserves legitimate new dispatcher creation with blank nullable phone',async()=>{
  h.invite.mockResolvedValue({data:{user:{id:'new-target'}},error:null});const r=await POST(req('POST',{phone:null}));expect(r.status).toBe(201);expect(h.updateUser).toHaveBeenCalledTimes(1);expect(h.upsert).toHaveBeenCalledTimes(2);
 });
 it('preserves authorized current dispatcher password setup',async()=>{
  expect((await PATCH(req('PATCH'))).status).toBe(200);expect(h.reset).toHaveBeenCalledTimes(1);
 });
});
