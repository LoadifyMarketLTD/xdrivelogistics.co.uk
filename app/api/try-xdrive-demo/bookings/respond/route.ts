import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../../memberAuth";
import {GET as getCanonicalOffers} from "../../../booking-offers/route";
import {POST as respondCanonicalOffer} from "../../../booking-offers/[id]/respond/route";
export const runtime="nodejs";
const deny=(status:number,error:string)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Legacy compatibility: route booking decisions through the production atomic offer flow. */
export async function POST(req:NextRequest){
 const member=await requireDemoMember(req);
 if(member instanceof NextResponse)return member;
 if(!["owner","admin","dispatcher"].includes(member.role.toLowerCase()))return deny(403,"Carrier operator role required");
 let body:{jobId?:string;decision?:string};
 try{body=await req.json()}catch{return deny(400,"Invalid JSON")}
 if(!uuid.test(body?.jobId||"")||!["accepted","rejected"].includes(body?.decision||""))return deny(400,"Valid job and decision required");
 const offersResponse=await getCanonicalOffers(new NextRequest(req.url,{headers:req.headers}));
 if(!offersResponse.ok)return offersResponse;
 const offersData=await offersResponse.json() as {offers?:Array<{id:string;job_id:string;carrier_company_id:string;status:string}>};
 const matching=(offersData.offers||[]).filter(offer=>offer.job_id===body.jobId&&offer.carrier_company_id===member.memberId&&offer.status==="pending");
 if(matching.length!==1)return deny(409,"No single pending production booking offer for this company and job");
 const offer=matching[0];
 const decision=body.decision==="accepted"?"accept":"decline";
 const forwarded=new NextRequest(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({action:decision})});
 const response=await respondCanonicalOffer(forwarded,{params:Promise.resolve({id:offer.id})});
 if(!response.ok)return response;
 return NextResponse.json({ok:true,bookingId:offer.id,stage:body.decision},{headers:{"Cache-Control":"no-store"}});
}
