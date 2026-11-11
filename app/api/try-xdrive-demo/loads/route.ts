import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../memberAuth";
export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
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
  const {data,error}=await member.db.from("jobs")
   .select("id,company_id,awarded_carrier_company_id,pickup_location,delivery_location,requested_vehicle_label,pallets,weight_kg,created_at,status,payment_terms,assigned_driver_id")
   .in("status",["awarded","allocated","in_transit","completed"])
   .or(`company_id.eq.${member.memberId},awarded_carrier_company_id.eq.${member.memberId}`)
   .order("created_at",{ascending:false}).limit(100);
  if(error)return deny(503,"Booking storage unavailable");
  return NextResponse.json((data||[])
   .filter(j=>j.company_id===member.memberId||j.awarded_carrier_company_id===member.memberId)
   .map(j=>({
    id:j.id,from:j.pickup_location||"",to:j.delivery_location||"",
    vehicle:j.requested_vehicle_label||"",pallets:String(j.pallets??""),weight:String(j.weight_kg??""),
    customer:j.company_id===member.memberId?"My company":"Awarded transport buyer",
    sell:"",postedAt:j.created_at||"",status:"Awarded",paymentTerms:j.payment_terms||"",
    assignedDriver:j.assigned_driver_id||undefined,readOnly:true,operationalStatus:j.status
   })),{headers:{"Cache-Control":"no-store"}});
 }
 if(req.nextUrl.searchParams.get("view")==="exchange"){
  const {data,error}=await member.db.from("jobs")
   .select("id,pickup_postcode,delivery_postcode,requested_vehicle_label,pallets,weight_kg,created_at,status,payment_terms")
   .eq("exchange_visibility","exchange").in("status",["posted","quoted"])
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
/**
 * Do not recreate loads from a legacy partial DEMO payload in the live database.
 * The approved Post Load form uses /api/jobs/create, with legal/Stripe and full
 * cargo, route, document and idempotency validation.
 */
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 return NextResponse.json({error:"Use the approved XDrive Post Load workflow to create a production load.",code:"CANONICAL_POST_LOAD_REQUIRED",actionHref:"/admin/post-load"},{status:409});
}
export async function PATCH(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 return NextResponse.json({error:"Use the production Loads workspace to change the job status.",code:"CANONICAL_JOB_TRANSITION_REQUIRED",actionHref:"/admin/loads"},{status:409});
}
