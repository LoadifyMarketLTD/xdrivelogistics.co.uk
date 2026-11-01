import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../../memberAuth";
export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(!["owner","admin","dispatcher"].includes(member.role.toLowerCase()))return deny(403,"Carrier operator required");
 let input:{jobId?:string;driver?:string;vehicle?:string};
 try{input=await req.json()}catch{return deny(400,"Invalid JSON")}
 const driver=typeof input.driver==="string"?input.driver.trim():"";
 const vehicle=typeof input.vehicle==="string"?input.vehicle.trim():"";
 if(!uuid.test(input.jobId||"")||!driver||driver.length>120||!vehicle||vehicle.length>80)return deny(400,"Valid job, driver and vehicle required");
 const {data:award,error:lookupError}=await member.db.from("xdrive_demo_awards").select("id,carrier_company_id,stage").eq("job_id",input.jobId!).maybeSingle();
 if(lookupError)return deny(503,"Booking unavailable");
 if(!award||award.carrier_company_id!==member.memberId)return deny(403,"Not your carrier booking");
 if(award.stage!=="accepted")return deny(409,"Booking is not ready for allocation");
 const {data,error}=await member.db.from("xdrive_demo_awards").update({assigned_driver_name:driver,assigned_vehicle_label:vehicle,allocated_at:new Date().toISOString(),stage:"allocated"}).eq("id",award.id).eq("carrier_company_id",member.memberId).eq("stage","accepted").select("id,stage").maybeSingle();
 if(error)return deny(403,"Assignment rejected");
 if(!data)return deny(409,"Booking changed concurrently");
 return NextResponse.json({ok:true,bookingId:data.id,stage:data.stage},{headers:{"Cache-Control":"no-store"}});
}
