import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../../memberAuth";
export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(!["owner","admin","dispatcher"].includes(member.role.toLowerCase()))return deny(403,"Carrier operator role required");
 let body:{jobId?:string;decision?:string};
 try{body=await req.json()}catch{return deny(400,"Invalid JSON")}
 if(!uuid.test(body?.jobId||"")||!["accepted","rejected"].includes(body?.decision||""))return deny(400,"Valid job and decision required");
 const {data:award,error:lookupError}=await member.db.from("xdrive_demo_awards").select("id,job_id,carrier_company_id,stage").eq("job_id",body.jobId!).maybeSingle();
 if(lookupError)return deny(503,"Booking lookup failed");
 if(!award||award.carrier_company_id!==member.memberId)return deny(403,"Not your carrier booking");
 if(award.stage!=="pending_acceptance")return deny(409,"Booking already decided");
 const {data,error}=await member.db.from("xdrive_demo_awards").update({stage:body.decision,responded_at:new Date().toISOString()}).eq("id",award.id).eq("carrier_company_id",member.memberId).eq("stage","pending_acceptance").select("id,stage").maybeSingle();
 if(error)return deny(403,"Booking decision not permitted");
 if(!data)return deny(409,"Booking decision changed concurrently");
 return NextResponse.json({ok:true,bookingId:data.id,stage:data.stage},{headers:{"Cache-Control":"no-store"}});
}
