import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../memberAuth";
import {previewLoadToJob} from "../../../../lib/try-xdrive-demo/canonicalMapping";
import type {Load} from "../../../../lib/try-xdrive-demo/store";
export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function publicOutcode(postcode:string|null):string {
 const p=(postcode||"").trim().toUpperCase();
 const full=p.match(/^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*[0-9][A-Z]{2}$/);
 if(full)return full[1];
 return /^[A-Z]{1,2}[0-9][A-Z0-9]?$/.test(p)?p:"Area unavailable";
}
export async function GET(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(req.nextUrl.searchParams.get("view")==="bookings"){
  // Company drivers must see only their own allocated transport, never every company booking.
  const isDriver=["driver","company_driver","company driver","employee_driver"].includes(member.role.trim().toLowerCase());
  let assignedDriverId:string|undefined;
  if(isDriver){
   const {data:driver,error:driverError}=await member.db.from("drivers").select("id").eq("user_id",member.userId).eq("company_id",member.memberId).maybeSingle();
   if(driverError)return deny(503,"Driver assignment lookup unavailable");
   if(!driver)return NextResponse.json([],{headers:{"Cache-Control":"no-store"}});
   assignedDriverId=driver.id;
  }
  const {data,error}=await member.db.from("jobs")
   .select("id,company_id,awarded_carrier_company_id,pickup_location,delivery_location,requested_vehicle_label,pallets,weight_kg,created_at,status,payment_terms,assigned_driver_id")
   .in("status",["awarded","allocated","in_transit","completed"])
   .or(`company_id.eq.${member.memberId},awarded_carrier_company_id.eq.${member.memberId}`)
   .order("created_at",{ascending:false}).limit(100);
  if(error)return deny(503,"Booking storage unavailable");
  return NextResponse.json((data||[]).filter(j=>(j.company_id===member.memberId||j.awarded_carrier_company_id===member.memberId)&&(!isDriver||j.assigned_driver_id===assignedDriverId)).map(j=>({
   id:j.id,from:j.pickup_location||"",to:j.delivery_location||"",
   vehicle:j.requested_vehicle_label||"",pallets:String(j.pallets??""),
   weight:String(j.weight_kg??""),customer:j.company_id===member.memberId?"My company":"Awarded transport buyer",
   sell:"",postedAt:j.created_at||"",status:"Awarded",
   paymentTerms:j.payment_terms||"",assignedDriver:j.assigned_driver_id||undefined,
   readOnly:true,operationalStatus:j.status
  })),{headers:{"Cache-Control":"no-store"}});
 }
 if(req.nextUrl.searchParams.get("view")==="exchange"){
  const {data,error}=await member.db.from("jobs")
   .select("id,pickup_postcode,delivery_postcode,requested_vehicle_label,pallets,weight_kg,created_at,status,payment_terms")
   .eq("exchange_visibility","exchange").eq("status","posted")
   .neq("company_id",member.memberId).order("created_at",{ascending:false}).limit(100);
  if(error)return deny(503,"Public exchange unavailable");
  return NextResponse.json((data||[]).map(j=>({
   id:j.id,from:publicOutcode(j.pickup_postcode),to:publicOutcode(j.delivery_postcode),
   vehicle:j.requested_vehicle_label||"",pallets:String(j.pallets??""),
   weight:String(j.weight_kg??""),customer:"Exchange member",sell:"",
   postedAt:j.created_at||"",status:"Open",paymentTerms:j.payment_terms||""
  })),{headers:{"Cache-Control":"no-store"}});
 }
 const {data,error}=await member.db.from("jobs")
 .select("id,company_id,pickup_location,delivery_location,requested_vehicle_label,pallets,weight_kg,created_at,status,payment_terms")
 .eq("company_id",member.memberId).order("created_at",{ascending:false}).limit(100);
 if(error)return deny(503,"Jobs storage unavailable");
 return NextResponse.json((data||[]).map(j=>({
  id:j.id,from:j.pickup_location||"",to:j.delivery_location||"",
  vehicle:j.requested_vehicle_label||"",pallets:String(j.pallets??""),
  weight:String(j.weight_kg??""),customer:"My company",sell:"",postedAt:j.created_at||"",
  status:j.status==="cancelled"?"Cancelled":["allocated","in_transit","completed","awarded"].includes(j.status)?"Awarded":"Open",
  paymentTerms:j.payment_terms||""
 })),{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest){const member=await requireDemoMember(req);if(member instanceof NextResponse)return member;if(!["owner","admin","dispatcher","manager"].includes(member.role.toLowerCase()))return deny(403,"Company operator required");let input:Partial<Load>;try{input=await req.json()}catch{return deny(400,"Invalid JSON")};if(!input||typeof input.from!=="string"||typeof input.to!=="string"||!input.from.trim()||!input.to.trim())return deny(400,"Pickup and delivery required");const load:Load={id:crypto.randomUUID(),from:input.from,to:input.to,vehicle:String(input.vehicle||""),pallets:String(input.pallets||""),weight:String(input.weight||""),customer:"",sell:"",postedAt:new Date().toISOString(),status:"Open",notes:typeof input.notes==="string"?input.notes:undefined,paymentTerms:typeof input.paymentTerms==="string"?input.paymentTerms:undefined};let mapped;try{mapped=previewLoadToJob(load,{companyId:member.memberId,userId:member.userId})}catch{return deny(400,"Invalid load details")};const {legacy_demo_id,...columns}=mapped;void legacy_demo_id;const {data,error}=await member.db.from("jobs").insert({...columns,exchange_visibility:"private"}).select("id").single();if(error)return deny(403,"Job creation not permitted");return NextResponse.json({...load,id:data.id},{status:201})}
export async function PATCH(req:NextRequest){const member=await requireDemoMember(req);if(member instanceof NextResponse)return member;if(!["owner","admin","dispatcher","manager"].includes(member.role.toLowerCase()))return deny(403,"Company operator required");let input:{id?:string;status?:string};try{input=await req.json()}catch{return deny(400,"Invalid JSON")};if(!input?.id||!uuid.test(input.id)||!input.status)return deny(400,"Job ID and status required");const transitions:Record<string,string[]>={draft:["posted","cancelled"],posted:["cancelled"],awarded:["allocated","cancelled"]};const {data:current,error:readError}=await member.db.from("jobs").select("id,status,created_by").eq("id",input.id).eq("company_id",member.memberId).maybeSingle();if(readError)return deny(503,"Job lookup unavailable");if(!current)return deny(403,"Job not owned by company");if(current.created_by!==member.userId&&!["owner","admin"].includes(member.role.toLowerCase()))return deny(403,"Job creator or company admin required");if(!transitions[current.status]?.includes(input.status))return deny(409,"Invalid job status transition");const {data,error}=await member.db.from("jobs").update({status:input.status,exchange_visibility:input.status==="posted"?"exchange":"private"}).eq("id",input.id).eq("company_id",member.memberId).eq("status",current.status).select("id").maybeSingle();if(error)return deny(403,"Job update not permitted");if(!data)return deny(409,"Job status changed concurrently or update denied");return NextResponse.json({ok:true,id:data.id,status:input.status})}
