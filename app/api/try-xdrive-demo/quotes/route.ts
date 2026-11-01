import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../memberAuth";
import {mayPerformDemoAction} from "../../../../lib/try-xdrive-demo/demoRolePolicy";
import {previewQuoteToJobBid} from "../../../../lib/try-xdrive-demo/canonicalMapping";
import type {Quote} from "../../../../lib/try-xdrive-demo/store";
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
export async function POST(req:NextRequest){const member=await requireDemoMember(req);if(member instanceof NextResponse)return member;if(!mayPerformDemoAction(member.role,"submit_quote"))return deny(403,"Quoting not permitted for this role");let input:{loadId?:string;amount?:number;notes?:string};try{input=await req.json()}catch{return deny(400,"Invalid JSON")};if(!input||typeof input.loadId!=="string"||typeof input.amount!=="number"||!Number.isFinite(input.amount)||input.amount<=0)return deny(400,"Valid job and amount required");const {data:job,error:jobError}=await member.db.from("jobs").select("id,company_id,exchange_visibility,status").eq("id",input.loadId).maybeSingle();if(jobError)return deny(503,"Job lookup unavailable");if(!job||job.company_id===member.memberId||job.exchange_visibility!=="exchange")return deny(403,"Job unavailable for quoting");if(job.status!=="posted")return deny(409,"Job is no longer open for quotes");const quote:Quote={id:crypto.randomUUID(),loadId:input.loadId,role:"",amount:input.amount,notes:typeof input.notes==="string"?input.notes:undefined,createdAt:new Date().toISOString(),status:"Open"};let mapped;try{mapped=previewQuoteToJobBid(quote,input.loadId,{companyId:member.memberId,userId:member.userId})}catch{return deny(400,"Invalid quote")};const {legacy_demo_quote_id,...columns}=mapped;void legacy_demo_quote_id;const {data,error}=await member.db.from("job_bids").insert(columns).select("id").single();if(error)return deny(403,"Quote creation not permitted");return NextResponse.json({...quote,id:data.id,role:"My company"},{status:201})}
export async function PATCH(req:NextRequest){const member=await requireDemoMember(req);if(member instanceof NextResponse)return member;if(!mayPerformDemoAction(member.role,"submit_quote"))return deny(403,"Quote changes not permitted for this role");let input:{id?:string;status?:string};try{input=await req.json()}catch{return deny(400,"Invalid JSON")};if(!input?.id||input.status!=="Withdrawn")return deny(400,"Invalid quote update");const {data,error}=await member.db.from("job_bids").update({status:"withdrawn"}).eq("id",input.id).eq("company_id",member.memberId).eq("bidder_user_id",member.userId).eq("status","submitted").select("id").maybeSingle();if(error)return deny(403,"Quote update not permitted");if(!data)return deny(403,"Quote not owned by this user");return NextResponse.json({ok:true})}
