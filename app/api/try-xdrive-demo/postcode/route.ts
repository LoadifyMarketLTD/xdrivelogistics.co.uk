import {nearbyStreets} from '../../../../lib/try-xdrive-demo/nearbyStreets';
import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
const full=/^(GIR 0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{1,2}) \d[A-Z]{2})$/;
const known:Record<string,string>={BB1:"Blackburn",DA8:"Erith"};
const normalize=(s:string)=>{const v=s.toUpperCase().replace(/\s/g,"");return v.length>3?v.slice(0,-3)+" "+v.slice(-3):v};
async function json(url:string){const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(5500)});if(!r.ok)throw Error(r.status===404?"Postcode not found":"Lookup unavailable");return r.json()}
export async function GET(req:NextRequest){
 const raw=(req.nextUrl.searchParams.get("postcode")||"").trim();
 if(raw.length>12||!/^[A-Za-z0-9 ]*$/.test(raw))return NextResponse.json({error:"Invalid postcode"},{status:400});
 const compact=raw.toUpperCase().replace(/\s/g,"");
 if(compact.length<2)return NextResponse.json({suggestions:[],area:"",complete:false});
 try{
  if(full.test(normalize(raw))){
   const postcode=normalize(raw),outcode=postcode.split(" ")[0];
   const data=await json("https://api.postcodes.io/postcodes/"+encodeURIComponent(postcode)) as {result?:{admin_district?:string}};
   const town=known[outcode]||data.result?.admin_district||"";
   if(!town)throw Error("Locality unavailable");
   const addresses:string[]=[];
   const addressKey=process.env.GETADDRESS_API_KEY?.trim();
   if(addressKey){
    try{
     const result=await json("https://api.getAddress.io/find/"+encodeURIComponent(postcode)+"?api-key="+encodeURIComponent(addressKey)) as {addresses?:string[]};
     for(const item of result.addresses||[])if(typeof item==="string"&&item.trim())addresses.push(item);
    }catch{ /* Provider may be unavailable: keep manual address entry enabled. */ }
   }
   const nearby=addresses.length?[]:await nearbyStreets(postcode);
   return NextResponse.json({postcode,outcode,town,display:town+" "+outcode,suggestions:[],addresses:addresses.slice(0,40),streets:nearby,approximateStreets:nearby.length>0,complete:true,addressSelectionAvailable:addresses.length>0},{headers:{"Cache-Control":"no-store"}});
  }
  const knownOutcode=Object.keys(known).find(code=>compact.startsWith(code))||"";
  const lookupPrefix=knownOutcode&&compact.length>knownOutcode.length?knownOutcode+" "+compact.slice(knownOutcode.length):compact;
  const response=await json("https://api.postcodes.io/postcodes/"+encodeURIComponent(lookupPrefix)+"/autocomplete?limit=100") as {result?:string[]|null};
  const all=Array.isArray(response.result)?response.result:[];
  const outcode=knownOutcode||compact.match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0]||"";
  const suggestions=all.filter(s=>s.replaceAll(" ","").startsWith(compact)&&(!knownOutcode||s.split(" ")[0]===knownOutcode)).slice(0,8);
  let area="";
  if(outcode.length>=3){
   if(known[outcode])area=known[outcode]+" "+outcode;
   else try{
    const info=await json("https://api.postcodes.io/outcodes/"+encodeURIComponent(outcode)) as {result?:{admin_district?:string[]}};
    if(info.result?.admin_district?.[0])area=info.result.admin_district[0]+" "+outcode;
   }catch{area=""}
  }
  return NextResponse.json({suggestions,area,complete:false,addresses:[]},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Lookup unavailable"},{status:503})}
}
