import { NextRequest, NextResponse } from 'next/server';
import { requireWebDriver } from '../../_lib/webDriver';
import { isDriverContext } from '../../mobile/_lib';
import { calculateDrivingRoute } from '../../../_lib/jobRouteMetrics';

export const dynamic = 'force-dynamic';
const reply=(value:Record<string,unknown>,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const valid=(lat:unknown,lng:unknown):lat is number=>typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
export async function GET(request:NextRequest){
 const driver=await requireWebDriver(request);
 if(!isDriverContext(driver))return driver;
 if(!driver.canCommercialBid||!driver.companyId||driver.companyStatus!=='active')return reply({error:'Active commercial driver access required.'},403);
 let body;try{body=JSON.parse(request.headers.get('x-xdrive-search-origin')||'null');}catch{return reply({error:'Invalid request.'},400);}
 const {lat,lng}=body??{};const outcode=request.nextUrl.searchParams.get('outcode');
 if(!valid(lat,lng)||typeof outcode!=='string'||!/^[A-Z]{1,2}\d[A-Z\d]?$/.test(outcode))return reply({error:'Valid origin and public outcode required.'},400);
 try{
  const response=await fetch('https://api.postcodes.io/outcodes/'+encodeURIComponent(outcode),{signal:AbortSignal.timeout(5000),next:{revalidate:86400}});
  if(!response.ok)return reply({error:'Public collection area unavailable.'},422);
  const payload=await response.json();const endLat=payload?.result?.latitude,endLng=payload?.result?.longitude;
  if(!valid(endLat,endLng))return reply({error:'Public collection area unavailable.'},422);
  // Only provider-confirmed driving distances. No straight-line fallback and no private job address.
  const route=await calculateDrivingRoute([{lat,lng},{lat:endLat,lng:endLng}]);
  if(!route||!Number.isFinite(route.distanceMiles)||route.distanceMiles<0)return reply({error:'Road distance unavailable.'},503);
  return reply({distanceMiles:route.distanceMiles,source:route.source,precision:'public_outcode'});
 }catch{return reply({error:'Road distance unavailable.'},503);}
}
