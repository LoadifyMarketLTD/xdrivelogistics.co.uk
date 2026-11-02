import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../../memberAuth";
import {canAwardDemoQuote,mayPerformDemoAction} from "../../../../../lib/try-xdrive-demo/demoRolePolicy";
export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
/** Award stays disabled until a dedicated atomic transaction is database-tested. */
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(!mayPerformDemoAction(member.role,"award_quote"))return deny(403,"Insufficient company role");
 let body:{jobId?:string;quoteId?:string};
 try{body=await req.json()}catch{return deny(400,"Invalid JSON")}
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!body||!uuid.test(body.jobId||"")||!uuid.test(body.quoteId||""))return deny(400,"Valid jobId and quoteId required");
 const {data:job,error:jobError}=await member.db.from("jobs").select("id,company_id,status,exchange_visibility,awarded_carrier_company_id").eq("id",body.jobId!).maybeSingle();
 if(jobError)return deny(503,"Job lookup unavailable");
 if(!job||job.company_id!==member.memberId)return deny(403,"Job not owned by your company");
 if(job.status!=="posted"||job.awarded_carrier_company_id)return deny(409,"Job no longer awardable");
 if(job.exchange_visibility!=="exchange")return deny(409,"Job not publicly offered");
 const {data:bid,error:bidError}=await member.db.from("job_bids").select("id,job_id,status,company_id").eq("id",body.quoteId!).maybeSingle();
 if(bidError)return deny(503,"Quote lookup unavailable");
 if(!bid||bid.job_id!==job.id||!canAwardDemoQuote({role:member.role,buyerCompanyId:job.company_id,actorCompanyId:member.memberId,carrierCompanyId:bid.company_id||"",jobStatus:job.status,visibility:job.exchange_visibility,bidStatus:bid.status,priorAwardedCarrierId:job.awarded_carrier_company_id}))return deny(409,"Quote not awardable");
 // The unique(job_id) constraint makes the dedicated DEMO award insert atomic.
 // No commercial job status or notification trigger is modified here.
 const {data:award,error:awardError}=await member.db.from("xdrive_demo_awards").insert({job_id:job.id,bid_id:bid.id,buyer_company_id:job.company_id,carrier_company_id:bid.company_id,awarded_by:member.userId,stage:"pending_acceptance"}).select("id,job_id,bid_id,stage").single();
 if(awardError)return deny(409,"Award was rejected by the database: check concurrent award, permissions or changed quote");
 return NextResponse.json({ok:true,awardId:award.id,jobId:award.job_id,quoteId:award.bid_id,stage:award.stage},{status:201,headers:{"Cache-Control":"no-store"}});
}
