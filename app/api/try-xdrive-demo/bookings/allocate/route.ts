import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../../memberAuth";
export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
/** Never write staging-only award rows or free-text driver names into production. */
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(!["owner","admin","dispatcher"].includes(member.role.toLowerCase()))return deny(403,"Carrier operator required");
 return NextResponse.json({
  error:"Assign a registered XDrive driver and vehicle through the production Bookings/My Fleet allocation workflow.",
  code:"CANONICAL_ALLOCATION_REQUIRED",
  actionHref:"/admin/bookings"
 },{status:409,headers:{"Cache-Control":"no-store"}});
}
