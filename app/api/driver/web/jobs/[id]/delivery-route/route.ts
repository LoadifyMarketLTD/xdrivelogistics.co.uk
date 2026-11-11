import { NextRequest } from 'next/server';

import { calculateDrivingRoute } from '../../../../../_lib/jobRouteMetrics';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { respond } from '../../../../mobile/_lib';
import { isWebDriverContext, requireActiveWebDriver } from '../../../../_lib/webDriverContext';

const numberOrNull = (value: unknown) => {
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:null;
};

export async function GET(request: NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!isSupabaseAdminConfigured||!supabaseAdmin)return respond(503,{error:'Server auth is not configured.'});
  const driver=await requireActiveWebDriver(request);
  if(!isWebDriverContext(driver))return driver;

  const {id:jobId}=await params;
  const {data:job,error:jobError}=await supabaseAdmin
    .from('jobs')
    .select('id,assigned_driver_id,current_status,status,delivery_lat,delivery_lng')
    .eq('id',jobId)
    .eq('assigned_driver_id',driver.driverId)
    .maybeSingle();
  if(jobError)return respond(500,{error:'Booking route could not be resolved.'});
  if(!job)return respond(404,{error:'Booking not found.'});

  const status=String(job.current_status??job.status??'').trim().toLowerCase();
  if(!['in_transit','on_my_way_to_delivery','on_my_way_delivery','on_route_delivery'].includes(status)){
    return respond(409,{error:'Live delivery route is available only while travelling to delivery.'});
  }

  const deliveryLat=numberOrNull(job.delivery_lat);
  const deliveryLng=numberOrNull(job.delivery_lng);
  if(deliveryLat===null||deliveryLng===null){
    return respond(200,{route:null,reason:'delivery_coordinates_unavailable'});
  }

  const {data:location,error:locationError}=await supabaseAdmin
    .from('driver_locations')
    .select('lat,lng,recorded_at')
    .eq('driver_id',driver.driverId)
    .eq('job_id',jobId)
    .order('recorded_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  if(locationError)return respond(500,{error:'Driver location could not be resolved.'});
  if(!location)return respond(200,{route:null,reason:'driver_location_unavailable'});

  const recordedAt=typeof location.recorded_at==='string'?location.recorded_at:null;
  const recordedMs=recordedAt?Date.parse(recordedAt):NaN;
  if(!Number.isFinite(recordedMs)||Date.now()-recordedMs>5*60*1000){
    return respond(200,{route:null,reason:'driver_location_stale'});
  }
  const currentLat=numberOrNull(location.lat);
  const currentLng=numberOrNull(location.lng);
  if(currentLat===null||currentLng===null){
    return respond(200,{route:null,reason:'driver_location_invalid'});
  }

  const metrics=await calculateDrivingRoute([
    {lat:currentLat,lng:currentLng},
    {lat:deliveryLat,lng:deliveryLng},
  ]);
  if(!metrics)return respond(200,{route:null,reason:'route_unavailable'});

  return respond(200,{
    route:{
      distanceMiles:metrics.distanceMiles,
      durationMinutes:metrics.durationMinutes,
      source:metrics.source,
      recordedAt,
      origin:{lat:currentLat,lng:currentLng},
      destination:{lat:deliveryLat,lng:deliveryLng},
      geometry:metrics.geometry??null,
    },
  });
}
