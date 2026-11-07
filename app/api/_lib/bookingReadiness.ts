import type { SupabaseClient } from '@supabase/supabase-js';

export type BookingReadiness = { ok: boolean; code?: string; error?: string; vehicleId?: string | null; capacity?: number | null };

/** Read-only preflight; database RPC must still enforce invariants transactionally. */
export async function inspectBookingReadiness(admin: SupabaseClient, jobId: string, bidId: string): Promise<BookingReadiness> {
  const [jobResult, bidResult] = await Promise.all([
    admin.from('jobs').select('pickup_datetime,delivery_datetime,pallets,collection_tail_lift_required,delivery_tail_lift_required').eq('id',jobId).maybeSingle(),
    admin.from('job_bids').select('id,job_id,company_id,bidder_driver_id,quote_vehicle_id,quote_vehicle_max_pallets').eq('id',bidId).maybeSingle(),
  ]);
  if (jobResult.error || bidResult.error || !jobResult.data || !bidResult.data || bidResult.data.job_id !== jobId)
    return {ok:false,code:'BOOKING_PREFLIGHT_UNAVAILABLE',error:'The load and quotation could not be verified.'};
  const job=jobResult.data, bid=bidResult.data;
  const pickup=Date.parse(String(job.pickup_datetime||''));
  if (!Number.isFinite(pickup) || pickup<=Date.now())
    return {ok:false,code:'COLLECTION_EXPIRED',error:'Collection time has passed. Update and reconfirm the collection schedule before sending or accepting an offer.'};
  const delivery=Date.parse(String(job.delivery_datetime||''));
  if (Number.isFinite(delivery) && delivery<pickup)
    return {ok:false,code:'INVALID_TRANSPORT_SCHEDULE',error:'Delivery cannot be earlier than collection.'};
  const pallets=Number(job.pallets);
  const vehicleId=typeof bid.quote_vehicle_id==='string'?bid.quote_vehicle_id:null;
  // Company/Carrier quotes without a named driver may allocate a vehicle after acceptance.
  // Named-driver quotations must already identify their actual verified vehicle.
  if (!vehicleId && bid.bidder_driver_id && Number.isFinite(pallets) && pallets>0)
    return {ok:false,code:'QUOTED_VEHICLE_REQUIRED',error:'The selected quotation has no linked vehicle. Confirm a suitable vehicle before booking.'};
  if (!vehicleId) return {ok:true,vehicleId:null,capacity:null};
  const {data:vehicle,error:vehicleError}=await admin.from('vehicles').select('id,company_id,assigned_driver_id,pallets_capacity,has_tail_lift').eq('id',vehicleId).maybeSingle();
  if (vehicleError || !vehicle) return {ok:false,code:'QUOTED_VEHICLE_UNAVAILABLE',error:'The quoted vehicle cannot be verified.'};
  if (bid.company_id && vehicle.company_id !== bid.company_id)
    return {ok:false,code:'QUOTED_VEHICLE_OWNERSHIP',error:'The quoted vehicle does not belong to the carrier that submitted the quotation.'};
  if (bid.bidder_driver_id && vehicle.assigned_driver_id && vehicle.assigned_driver_id !== bid.bidder_driver_id)
    return {ok:false,code:'QUOTED_VEHICLE_DRIVER_MISMATCH',error:'The quoted vehicle is assigned to a different driver. Reconfirm driver and vehicle assignment.'};
  const values=[Number(vehicle.pallets_capacity),Number(bid.quote_vehicle_max_pallets)].filter(x=>Number.isFinite(x)&&x>0);
  const capacity=values.length?Math.min(...values):null;
  if(Number.isFinite(pallets)&&pallets>0 && capacity===null)
    return {ok:false,code:'VEHICLE_CAPACITY_UNVERIFIED',error:'The quoted vehicle has no verified pallet capacity.'};
  if(Number.isFinite(pallets)&&pallets>0&&capacity!==null&&pallets>capacity)
    return {ok:false,code:'VEHICLE_CAPACITY_EXCEEDED',error:`This load needs ${pallets} pallets, but the quoted vehicle is limited to ${capacity}. Assign a compatible vehicle and obtain a revised quotation.`,vehicleId,capacity};
  if((job.collection_tail_lift_required||job.delivery_tail_lift_required)&&vehicle.has_tail_lift!==true)
    return {ok:false,code:'TAIL_LIFT_REQUIRED',error:'A tail-lift is required but the quoted vehicle is not recorded as tail-lift equipped.',vehicleId,capacity};
  return {ok:true,vehicleId,capacity};
}
