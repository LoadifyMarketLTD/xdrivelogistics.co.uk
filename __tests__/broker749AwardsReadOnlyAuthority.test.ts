import {describe,it,expect} from 'vitest';
import {isRoleAllowedForPath} from '../lib/authRole';
import {hasWorkspaceCapabilityForContext} from '../lib/roleCapabilities';
const active={workspaceRole:'broker' as const,rawRole:'broker',accountStatus:'active',companyStatus:'active'};
describe('Broker Bookings / Awarded route preserves RBAC',()=>{
 it('viewer/member can view their awarded bookings but cannot perform restricted awards',()=>{
  for(const membershipRole of ['viewer','member']) {
   const context={...active,membershipRole};
   expect(isRoleAllowedForPath('/broker/awards','broker',context)).toBe(false);
   expect(isRoleAllowedForPath('/broker/jobs?view=awarded','broker',context)).toBe(true);
   expect(hasWorkspaceCapabilityForContext('broker','quotes.award',context)).toBe(false);
  }
 });
 it('owner/admin/dispatcher retain awards route access without changing capability rules',()=>{
  for(const membershipRole of ['owner','admin','dispatcher']) {
   const context={...active,membershipRole};
   expect(isRoleAllowedForPath('/broker/awards','broker',context)).toBe(true);
   expect(isRoleAllowedForPath('/broker/jobs?view=awarded','broker',context)).toBe(true);
  }
 });
 it('other workspaces cannot cross into Broker awards or bookings',()=>{
  expect(isRoleAllowedForPath('/broker/awards','customer',{workspaceRole:'customer',accountStatus:'active',companyStatus:'active'})).toBe(false);
  expect(isRoleAllowedForPath('/broker/jobs','customer',{workspaceRole:'customer',accountStatus:'active',companyStatus:'active'})).toBe(false);
 });
});