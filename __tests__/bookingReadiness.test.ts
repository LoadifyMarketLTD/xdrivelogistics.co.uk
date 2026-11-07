import {describe,it,expect} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {inspectBookingReadiness} from '../app/api/_lib/bookingReadiness';

function mockClient(job:Record<string,unknown>|null,bid:Record<string,unknown>|null,vehicle:Record<string,unknown>|null) {
  const tables:Record<string,Record<string,unknown>|null>={jobs:job,job_bids:bid,vehicles:vehicle};
  return {from:(name:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:tables[name],error:null})})})})} as unknown as SupabaseClient;
}
const future=(days:number)=>new Date(Date.now()+days*86400000).toISOString();
const bid={id:'b1',job_id:'j1',quote_vehicle_id:'v1',quote_vehicle_max_pallets:4};
const vehicle={id:'v1',pallets_capacity:4,has_tail_lift:true};
const job={pickup_datetime:future(2),delivery_datetime:future(3),pallets:3,collection_tail_lift_required:false,delivery_tail_lift_required:false};

describe('booking readiness: fail-closed server contract',()=>{
  it('blocks expired collection',async()=>{
    const result=await inspectBookingReadiness(mockClient({...job,pickup_datetime:future(-1)},bid,vehicle),'j1','b1');
    expect(result).toMatchObject({ok:false,code:'COLLECTION_EXPIRED'});
  });
  it('blocks oversized pallet count',async()=>{
    const result=await inspectBookingReadiness(mockClient({...job,pallets:6},bid,vehicle),'j1','b1');
    expect(result).toMatchObject({ok:false,code:'VEHICLE_CAPACITY_EXCEEDED'});
  });
  it('blocks incompatible tail lift',async()=>{
    const result=await inspectBookingReadiness(mockClient({...job,collection_tail_lift_required:true},bid,{...vehicle,has_tail_lift:false}),'j1','b1');
    expect(result).toMatchObject({ok:false,code:'TAIL_LIFT_REQUIRED'});
  });
  it('blocks a quote without any verified vehicle for a pallet load',async()=>{
    const result=await inspectBookingReadiness(mockClient(job,{...bid,bidder_driver_id:'driver-a',quote_vehicle_id:null},null),'j1','b1');
    expect(result).toMatchObject({ok:false,code:'QUOTED_VEHICLE_REQUIRED'});
  });
  it('allows a company-only quote to allocate its vehicle after acceptance',async()=>{
    const result=await inspectBookingReadiness(mockClient(job,{...bid,company_id:'carrier-a',bidder_driver_id:null,quote_vehicle_id:null},null),'j1','b1');
    expect(result).toMatchObject({ok:true,vehicleId:null,capacity:null});
  });
  it('blocks if delivery precedes collection',async()=>{
    const result=await inspectBookingReadiness(mockClient({...job,delivery_datetime:future(1)},bid,vehicle),'j1','b1');
    expect(result).toMatchObject({ok:false,code:'INVALID_TRANSPORT_SCHEDULE'});
  });
  it('blocks a vehicle owned by a different carrier',async()=>{
    const result=await inspectBookingReadiness(mockClient(job,{...bid,company_id:'carrier-a'},{...vehicle,company_id:'carrier-b'}),'j1','b1');
    expect(result).toMatchObject({ok:false,code:'QUOTED_VEHICLE_OWNERSHIP'});
  });
  it('blocks vehicle assigned to a different driver',async()=>{
    const result=await inspectBookingReadiness(mockClient(job,{...bid,bidder_driver_id:'driver-a'},{...vehicle,assigned_driver_id:'driver-b'}),'j1','b1');
    expect(result).toMatchObject({ok:false,code:'QUOTED_VEHICLE_DRIVER_MISMATCH'});
  });
  it('accepts valid schedule and matching capacity',async()=>{
    const result=await inspectBookingReadiness(mockClient(job,bid,vehicle),'j1','b1');
    expect(result).toMatchObject({ok:true,vehicleId:'v1',capacity:4});
  });
});