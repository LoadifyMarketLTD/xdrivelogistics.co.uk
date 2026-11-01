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
 return deny(503,"Operational transaction unavailable: requires an approved atomic production workflow and authorization tests");
}
