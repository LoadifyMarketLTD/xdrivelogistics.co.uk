import { NextRequest, NextResponse } from 'next/server';
import { requireWebDriver } from '../../_lib/webDriver';
import { isDriverContext } from '../../mobile/_lib';

export async function GET(request:NextRequest){
 const driver=await requireWebDriver(request);
 if(!isDriverContext(driver))return driver;
 const code=(new URL(request.url).searchParams.get('outcode')||'').trim().toUpperCase();
 if(!/^[A-Z]{1,2}\d[A-Z\d]?$/.test(code))return NextResponse.json({error:'Invalid outcode'},{status:400});
 try{
  const response=await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(code)}`,{signal:AbortSignal.timeout(6500),next:{revalidate:86400}});
  if(!response.ok)return NextResponse.json({error:'Area unavailable'},{status:502});
  const data=await response.json();const lat=data?.result?.latitude,lng=data?.result?.longitude;
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return NextResponse.json({error:'Area unavailable'},{status:502});
  return NextResponse.json({outcode:code,latitude:lat,longitude:lng});
 }catch{return NextResponse.json({error:'Area lookup unavailable'},{status:503});}
}
