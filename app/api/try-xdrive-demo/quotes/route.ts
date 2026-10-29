import {NextResponse} from "next/server";
type Quote={id:string;loadId:string;role:string;amount:number;createdAt:string;status:"Open"|"Withdrawn"};
const store=globalThis as typeof globalThis&{__xdriveDemoQuotes?:Quote[];__xdriveDemoLoads?:{id:string;status:string}[]};
function list(){return store.__xdriveDemoQuotes??(store.__xdriveDemoQuotes=[])}
export async function GET(){return NextResponse.json(list(),{headers:{"Cache-Control":"no-store"}})}
export async function POST(req:Request){const d=await req.json();const amount=Number(d.amount);if(typeof d.loadId!=="string"||!Number.isFinite(amount)||amount<=0||!["Driver","Fleet","Carrier","Broker"].includes(d.role))return NextResponse.json({error:"Invalid demo quote"},{status:400});if(!store.__xdriveDemoLoads?.some(x=>x.id===d.loadId&&x.status==="Open"))return NextResponse.json({error:"Load is unavailable"},{status:409});const q:Quote={id:"XDQ-DEMO-"+Date.now(),loadId:d.loadId,role:d.role,amount,createdAt:new Date().toISOString(),status:"Open"};list().unshift(q);return NextResponse.json(q,{status:201})}
export async function PATCH(req:Request){const d=await req.json();const q=list().find(x=>x.id===d.id);if(!q)return NextResponse.json({error:"Quote not found"},{status:404});if(d.status!=="Withdrawn")return NextResponse.json({error:"Invalid status"},{status:400});q.status="Withdrawn";return NextResponse.json(q)}
