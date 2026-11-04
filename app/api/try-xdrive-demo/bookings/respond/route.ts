import {NextRequest,NextResponse} from 'next/server';
import {getBearerToken} from '../../../_lib/supabaseAdmin';
import {POST as respondCommercialOffer} from '../../../booking-offers/[id]/respond/route';
export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Legacy adapter accepts only the canonical offer UUID, never a job ID. */
export async function POST(request:NextRequest){
 if(!getBearerToken(request))return NextResponse.json({error:'Authentication required'},{status:401});
 const body=await request.json().catch(()=>null) as {offerId?:string;decision?:string;reason?:string}|null;
 if(!body||!uuid.test(body.offerId||'')||!['accepted','rejected'].includes(body.decision||''))return NextResponse.json({error:'Valid booking offer ID and decision required'},{status:400});
 const canonical=new NextRequest(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({action:body.decision==='accepted'?'accept':'decline',reason:body.reason})});
 return respondCommercialOffer(canonical,{params:Promise.resolve({id:body.offerId!})});
}
