import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../../memberAuth";
import {POST as respondToExistingOffer} from "../../../booking-offers/[id]/respond/route";
export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(!["owner","admin","dispatcher"].includes(member.role.toLowerCase()))return deny(403,"Carrier operator role required");
 let body:{jobId?:string;decision?:string};
 try{body=await req.json()}catch{return deny(400,"Invalid JSON")}
 if(!uuid.test(body?.jobId||"")||!["accepted","rejected"].includes(body?.decision||""))return deny(400,"Valid job and decision required");
 const {data:offer,error}=await member.db.from("job_booking_offers")
  .select("id,job_id,carrier_company_id,status").eq("job_id",body.jobId!)
  .eq("carrier_company_id",member.memberId).eq("status","pending").maybeSingle();
 if(error)return deny(503,"Booking offer lookup unavailable");
 if(!offer)return deny(404,"No pending booking offer for this company");
 const action=body.decision==="accepted"?"accept":"decline";
 const delegated=new NextRequest(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({action})});
 return respondToExistingOffer(delegated,{params:Promise.resolve({id:offer.id})});
}
