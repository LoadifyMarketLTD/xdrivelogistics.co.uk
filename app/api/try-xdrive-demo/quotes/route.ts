import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../memberAuth";
import {mayPerformDemoAction} from "../../../../lib/try-xdrive-demo/demoRolePolicy";
import {POST as companyMarketplaceAction} from "../../marketplace/company/route";
export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 const received=req.nextUrl.searchParams.get("view")==="received";
 let query=member.db.from("job_bids").select("id,job_id,company_id,bidder_user_id,amount,message,created_at,status");
 if(received){
  if(!mayPerformDemoAction(member.role,"view_received_quotes"))return deny(403,"Company operator required");
  const {data:jobs,error:jobsError}=await member.db.from("jobs").select("id").eq("company_id",member.memberId).order("created_at",{ascending:false}).limit(100);
  if(jobsError)return deny(503,"Owned jobs unavailable");
  const ids=(jobs||[]).map(j=>j.id);
  if(!ids.length)return NextResponse.json([],{headers:{"Cache-Control":"no-store"}});
  query=query.in("job_id",ids).neq("company_id",member.memberId);
 }else{
  query=query.eq("company_id",member.memberId).eq("bidder_user_id",member.userId);
 }
 const {data,error}=await query.order("created_at",{ascending:false}).limit(100);
 if(error)return deny(503,"Quotes storage unavailable");
 const ids=[...new Set((data||[]).map(q=>q.job_id).filter(Boolean))];
 const {data:jobs,error:routeError}=ids.length?await member.db.from("jobs")
  .select("id,pickup_postcode,delivery_postcode,requested_vehicle_label")
  .in("id",ids):{data:[],error:null};
 if(routeError)return deny(503,"Quote route lookup unavailable");
 const outcode=(value:string|null)=>{const p=(value||"").trim().toUpperCase();const m=p.match(/^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*[0-9][A-Z]{2}$/);return m?m[1]:/^[A-Z]{1,2}[0-9][A-Z0-9]?$/.test(p)?p:"Area unavailable"};
 const jobById=new Map((jobs||[]).map(j=>[j.id,j]));
 return NextResponse.json((data||[]).map(q=>{
  const j=jobById.get(q.job_id);
  return {id:q.id,loadId:q.job_id,role:received?"Carrier":"My company",amount:Number(q.amount),notes:q.message||"",createdAt:q.created_at||"",status:q.status==="withdrawn"?"Withdrawn":q.status==="submitted"?"Open":q.status==="accepted"?"Accepted":q.status==="rejected"?"Rejected":q.status,route:j?{from:outcode(j.pickup_postcode),to:outcode(j.delivery_postcode),vehicle:j.requested_vehicle_label||""}:null}
 }),{headers:{"Cache-Control":"no-store"}});
}
/**
 * Compatibility adapter. All production quote writes use the canonical company
 * marketplace endpoint, retaining its legal, Stripe, ownership and bid guards.
 * Legacy workspace callers must never insert job_bids directly.
 */
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(!mayPerformDemoAction(member.role,"submit_quote"))return deny(403,"Quoting not permitted for this role");
 let input:{loadId?:string;amount?:number;notes?:string;etaMinutes?:number};
 try{input=await req.json()}catch{return deny(400,"Invalid JSON")}
 if(!input||typeof input.loadId!=="string"||typeof input.amount!=="number"||!Number.isFinite(input.amount)||input.amount<=0)return deny(400,"Valid job and amount required");
 const forwarded=new NextRequest(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({action:"submit_bid",companyId:member.memberId,jobId:input.loadId,amount:input.amount,currency:"GBP",message:typeof input.notes==="string"?input.notes:""})});
 const result=await companyMarketplaceAction(forwarded);
 if(!result.ok)return result;
 const data=await result.json() as {bid?:{id:string;created_at?:string;amount?:number}};
 return NextResponse.json({id:data.bid?.id,loadId:input.loadId,amount:input.amount,role:"My company",createdAt:data.bid?.created_at||"",status:"Open"},{status:201,headers:{"Cache-Control":"no-store"}});
}
export async function PATCH(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(!mayPerformDemoAction(member.role,"submit_quote"))return deny(403,"Quote changes not permitted for this role");
 let input:{id?:string;status?:string};
 try{input=await req.json()}catch{return deny(400,"Invalid JSON")}
 if(!input?.id||input.status!=="Withdrawn")return deny(400,"Invalid quote update");
 const forwarded=new NextRequest(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({action:"withdraw_bid",companyId:member.memberId,bidId:input.id})});
 return companyMarketplaceAction(forwarded);
}
