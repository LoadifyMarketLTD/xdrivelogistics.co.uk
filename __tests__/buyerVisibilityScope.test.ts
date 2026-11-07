import {describe,it,expect} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {getBuyerViewMemberships} from '../app/api/_lib/buyerVisibilityScope';

const base=[
  {company_id:'buyer-a',role_in_company:'member'},
  {company_id:'buyer-b',role_in_company:'admin'},
  {company_id:'buyer-c',role_in_company:'viewer'},
];
function admin(memberships=base,drivers:Array<{driver_type:string}> =[],driverError=false) {
  return {from:(name:string)=>({
    select:()=>({
      eq:()=>({
        eq:async()=>name==='company_memberships'
          ? {data:memberships,error:null}
          : {data:drivers,error:driverError?{message:'unavailable'}:null},
      }),
    }),
  })} as unknown as SupabaseClient;
}
describe('Buyer bidder data role isolation',()=>{
  it('does not expose Customer quote bidder identities to ordinary Company Drivers',async()=>{
    const result=await getBuyerViewMemberships(admin(base,[{driver_type:'company_driver'}]),'u1');
    expect(result.map(row=>row.company_id)).toEqual(['buyer-b']);
  });
  it('allows read-only customer members when they are not Company Drivers',async()=>{
    const result=await getBuyerViewMemberships(admin(base,[]),'u1');
    expect(result).toHaveLength(3);
  });
  it('preserves Owner Driver admin rights without inheriting Company Driver restrictions',async()=>{
    const result=await getBuyerViewMemberships(admin(base,[{driver_type:'owner_driver'}]),'u1');
    expect(result).toHaveLength(3);
  });
  it('fails closed when driver identity cannot be checked',async()=>{
    await expect(getBuyerViewMemberships(admin(base,[],true),'u1')).rejects.toThrow(/could not be verified/);
  });
});
