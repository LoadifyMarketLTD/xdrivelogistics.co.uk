import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../memberAuth";
export const runtime="nodejs";
export async function GET(request:NextRequest){
 const member=await requireDemoMember(request);
 if(member instanceof NextResponse)return member;
 const q=(request.nextUrl.searchParams.get("q")||"").trim().slice(0,80);
 let query=member.db.from("companies").select("id,name,city,postcode,company_type,status").eq("status","active").order("name",{ascending:true}).limit(80);
 if(q)query=query.or(`name.ilike.%${q.replace(/[%_,.()]/g,"")}%,city.ilike.%${q.replace(/[%_,.()]/g,"")}%,postcode.ilike.%${q.replace(/[%_,.()]/g,"")}%`);
 const {data,error}=await query;
 if(error)return NextResponse.json({error:"Directory unavailable under member permissions"},{status:503});
 return NextResponse.json((data||[]).map(c=>({id:c.id,name:c.name,area:[c.city,c.postcode?.split(" ")[0]].filter(Boolean).join(" "),type:c.company_type||"Company"})),{headers:{"Cache-Control":"private, no-store"}});
}
