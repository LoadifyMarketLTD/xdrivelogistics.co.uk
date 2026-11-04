import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../../memberAuth";
import {mayPerformDemoAction} from "../../../../../lib/try-xdrive-demo/demoRolePolicy";
import {POST as acceptCanonicalBid} from "../../../admin/bids/[id]/accept/route";
export const runtime="nodejs";
const deny=(status:number,error:string,code?:string)=>NextResponse.json({error,code},{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Production award adapter. Explicit payment acknowledgment is mandatory. */
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(!mayPerformDemoAction(member.role,"award_quote"))return deny(403,"Insufficient company role");
 let body:{jobId?:string;quoteId?:string;paymentObligationAcknowledged?:boolean};
 try{body=await req.json()}catch{return deny(400,"Invalid JSON")}
 if(!uuid.test(body?.jobId||"")||!uuid.test(body?.quoteId||""))return deny(400,"Valid job and quote reference required");
 if(body.paymentObligationAcknowledged!==true)return deny(409,"You must explicitly acknowledge the transport buyer payment obligation before awarding this quote. Use the approved Quotes award flow.","PAYMENT_OBLIGATION_ACK_REQUIRED");
 const {data:job,error}=await member.db.from("jobs").select("id,company_id").eq("id",body.jobId!).eq("company_id",member.memberId).maybeSingle();
 if(error)return deny(503,"Job ownership verification unavailable");
 if(!job)return deny(403,"Job not owned by your company");
 const {data:quote,error:quoteError}=await member.db.from("job_bids").select("id,job_id").eq("id",body.quoteId!).eq("job_id",job.id).maybeSingle();
 if(quoteError)return deny(503,"Quote verification unavailable");
 if(!quote)return deny(404,"Quote does not belong to this job");
 const forwarded=new NextRequest(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({paymentObligationAcknowledged:true})});
 return acceptCanonicalBid(forwarded,{params:Promise.resolve({id:body.quoteId!})});
}
