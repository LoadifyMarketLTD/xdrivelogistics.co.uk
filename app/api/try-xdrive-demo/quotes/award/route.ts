import {NextRequest,NextResponse} from 'next/server';
import {getBearerToken} from '../../../_lib/supabaseAdmin';
import {POST as awardCommercialBid} from '../../../customer/bids/[id]/award/route';
export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Legacy workspace adapter: commercial awards must use the canonical guarded transaction. */
export async function POST(request:NextRequest){
 if(!getBearerToken(request))return NextResponse.json({error:'Authentication required'},{status:401});
 const body=await request.json().catch(()=>null) as {jobId?:string;quoteId?:string;paymentObligationAcknowledged?:boolean}|null;
 if(!body||!uuid.test(body.jobId||'')||!uuid.test(body.quoteId||''))return NextResponse.json({error:'Valid job and quote IDs required'},{status:400});
 if(body.paymentObligationAcknowledged!==true)return NextResponse.json({error:'Explicit payment obligation acknowledgement required'},{status:409});
 const canonical=new NextRequest(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({paymentObligationAcknowledged:true})});
 return awardCommercialBid(canonical,{params:Promise.resolve({id:body.quoteId!})});
}
