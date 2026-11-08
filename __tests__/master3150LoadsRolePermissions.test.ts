import {describe,expect,it} from 'vitest';
import {hasWorkspaceCapability} from '../lib/workspaceRole';
import {membershipHasCapability} from '../lib/membershipRole';
import {isCapabilityAllowedForPath} from '../lib/roleCapabilities';

describe('3150 Loads: Fleet Manager and Dispatcher allowed but limited',()=>{
 it.each(['fleet_manager','dispatcher'] as const)('%s may see and quote real marketplace loads',role=>{
  expect(hasWorkspaceCapability(role,'loads.view.marketplace')).toBe(true);
  expect(hasWorkspaceCapability(role,'quotes.submit')).toBe(true);
  expect(membershipHasCapability(role,'loads.view.marketplace')).toBe(true);
  expect(membershipHasCapability(role,'quotes.submit')).toBe(true);
  expect(isCapabilityAllowedForPath('/admin/marketplace','company_staff',{
   workspaceRole:role,membershipRole:role,accountStatus:'active',companyStatus:'active',
  })).toBe(true);
 });
 it('does not extend marketplace access to finance, compliance or viewer',()=>{
  for(const role of ['finance','compliance','viewer'] as const){
   expect(hasWorkspaceCapability(role,'loads.view.marketplace')).toBe(false);
   expect(isCapabilityAllowedForPath('/admin/marketplace','company_staff',{
    workspaceRole:role,membershipRole:role,accountStatus:'active',companyStatus:'active',
   })).toBe(false);
  }
 });
 it('rejects inactive company status even for eligible operator',()=>{
  expect(isCapabilityAllowedForPath('/admin/marketplace','company_staff',{
   workspaceRole:'fleet_manager',membershipRole:'fleet_manager',
   accountStatus:'active',companyStatus:'suspended',
  })).toBe(false);
 });
});
