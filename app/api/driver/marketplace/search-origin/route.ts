import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { requireWebDriver } from '../../_lib/webDriver';
import { isDriverContext } from '../../mobile/_lib';
import { resolveDriverOperationalEligibility } from '../../_lib/operationalEligibility';

export const dynamic = 'force-dynamic';
const reply=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:NextRequest){
 const driver=await requireWebDriver(request);
 if(!isDriverContext(driver))return driver;
 if(!driver.companyId||!driver.canCommercialBid||driver.companyStatus!=='active')return reply({error:'Commercial driver access required.'},403);
 try{
  const admin=supabaseAdmin!;
  const eligibility=await resolveDriverOperationalEligibility(admin,driver.driverId);
  const vehicleId=eligibility.canonicalVehicleId;
  if(!vehicleId||eligibility.blockers.some(code=>['canonical_vehicle_company_mismatch','canonical_vehicle_ambiguous','driver_company_membership_not_active','driver_company_not_active'].includes(code)))return reply({error:'No uniquely assigned active vehicle found.'},409);
  const {data:vehicle,error:vehicleError}=await admin.from('vehicles').select('id').eq('id',vehicleId).eq('company_id',driver.companyId).eq('assigned_driver_id',driver.driverId).eq('status','active').maybeSingle();
  if(vehicleError)return reply({error:'Vehicle assignment could not be verified.'},503);
  if(!vehicle)return reply({error:'No authorised vehicle assignment found.'},409);
  const {data:position,error}=await admin.from('driver_locations').select('lat,lng,recorded_at').eq('company_id',driver.companyId).eq('driver_id',driver.driverId).eq('vehicle_id',vehicleId).gte('recorded_at',new Date(Date.now()-120*60_000).toISOString()).order('recorded_at',{ascending:false}).limit(1).maybeSingle();
  if(error)return reply({error:'Vehicle location could not be verified.'},503);
  if(!position||position.lat==null||position.lng==null)return reply({error:'No recent authorised vehicle position. Use Current Location or Select Location.'},409);
  const lat=Number(position.lat),lng=Number(position.lng),age=Date.now()-Date.parse(position.recorded_at);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||!Number.isFinite(age)||age<0||age>120*60_000)return reply({error:'Vehicle position is unavailable or stale.'},409);
  return reply({latitude:lat,longitude:lng,recordedAt:position.recorded_at});
 }catch{return reply({error:'Vehicle location temporarily unavailable.'},503);}
}
