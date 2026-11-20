import { describe, expect, it } from 'vitest';
import { resolveWorkspaceRole } from '../lib/workspaceRole';
import { isRoleAllowedForPath } from '../lib/authRole';
const active={accountStatus:'active',companyStatus:'active'} as const;
describe('explicit restricted membership precedence',()=>{
 it.each(['fleet_manager','dispatcher','finance','compliance'])('viewer cannot inherit historical %s profile permissions',rawRole=>{
  const role=resolveWorkspaceRole({role:'company_staff',rawRole,membershipRole:'viewer'});
  expect(role).toBe('viewer');
  expect(isRoleAllowedForPath('/admin/team','company_staff',{...active,rawRole,membershipRole:'viewer',workspaceRole:role})).toBe(false);
  expect(isRoleAllowedForPath('/admin/invoices','company_staff',{...active,rawRole,membershipRole:'viewer',workspaceRole:role})).toBe(false);
 });
 it.each([['dispatcher','fleet_manager'],['finance','fleet_manager'],['compliance','dispatcher'],['fleet_manager','viewer']] as const)('membership %s overrides legacy profile %s',(membershipRole,rawRole)=>{
  expect(resolveWorkspaceRole({role:'company_staff',rawRole,membershipRole})).toBe(membershipRole);
 });
 it('preserves existing customer and broker surface identity for viewers',()=>{
  for(const role of ['customer','broker'] as const){
   expect(resolveWorkspaceRole({role,rawRole:role,membershipRole:'viewer'})).toBe(role);
   expect(isRoleAllowedForPath('/'+role+'/post-load',role,{...active,membershipRole:'viewer',workspaceRole:role})).toBe(false);
  }
 });
 it('preserves documented legacy fleet member compatibility',()=>{
   expect(resolveWorkspaceRole({role:'company_staff',rawRole:'fleet_manager',membershipRole:'member'})).toBe('fleet_manager');
 });
});
