import {NextRequest,NextResponse} from 'next/server';
import {getBearerToken} from '../../../_lib/supabaseAdmin';
import {POST as assignCanonicalDriver} from '../../../admin/jobs/[id]/assign-driver/route';

export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Compatibility adapter only. The production assign_job_driver_atomic RPC
 * validates tenant membership and driver eligibility, then assigns the
 * driver's canonical compliant vehicle in the same database transaction.
 * Never trust a free-text or client-selected vehicle identifier.
 */
export async function POST(request:NextRequest){
 if(!getBearerToken(request))return NextResponse.json({error:'Authentication required'},{status:401});
 const body=await request.json().catch(()=>null) as {
  jobId?:string;driverId?:string;vehicleId?:string;
  expectedDriverId?:string|null;
 }|null;
 if(!body||!uuid.test(body.jobId||'')||!uuid.test(body.driverId||'')){
  return NextResponse.json({error:'Valid job and driver IDs required.'},{status:400});
 }
 if(body.vehicleId!==undefined){
  return NextResponse.json({error:'Vehicle is selected by the canonical driver eligibility workflow, not by client input.'},{status:400});
 }
 if(body.expectedDriverId!==undefined&&body.expectedDriverId!==null&&!uuid.test(body.expectedDriverId)){
  return NextResponse.json({error:'Invalid expected driver ID.'},{status:400});
 }
 const canonical=new NextRequest(request.url,{
  method:'POST',headers:request.headers,
  body:JSON.stringify({driverId:body.driverId,expectedDriverId:body.expectedDriverId??null})
 });
 return assignCanonicalDriver(canonical,{params:Promise.resolve({id:body.jobId!})});
}
