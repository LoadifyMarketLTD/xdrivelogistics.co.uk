import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../../memberAuth";
import {POST as awardUsingExistingCommercialWorkflow} from "../../../customer/bids/[id]/award/route";

export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reuse the production-grade award transaction and its authorization, legal, risk,
 * Stripe, payment acknowledgement and concurrency controls; never write directly. */
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 let body:{jobId?:string;quoteId?:string;paymentObligationAcknowledged?:boolean};
 try{body=await req.json()}catch{return deny(400,"Invalid JSON")}
 if(!uuid.test(body?.jobId||"")||!uuid.test(body?.quoteId||""))return deny(400,"Valid jobId and quoteId required");
 if(body.paymentObligationAcknowledged!==true)return deny(409,"Explicit payment obligation acknowledgement required");
 const {data:bid,error:bidError}=await member.db.from("job_bids").select("id,job_id").eq("id",body.quoteId!).maybeSingle();
 if(bidError)return deny(503,"Quote lookup unavailable");
 if(!bid||bid.job_id!==body.jobId)return deny(409,"Quote does not belong to the requested transport");
 // The existing commercial endpoint checks the bid-to-job relationship and the
 // job owner's active membership again, independent of this workspace's guard.
 const delegated=new NextRequest(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({paymentObligationAcknowledged:true})});
 return awardUsingExistingCommercialWorkflow(delegated,{params:Promise.resolve({id:body.quoteId!})});
}
