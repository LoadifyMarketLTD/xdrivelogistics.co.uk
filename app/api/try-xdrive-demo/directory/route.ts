import {NextRequest,NextResponse} from "next/server";
import {requireDemoMember} from "../memberAuth";

export const runtime="nodejs";
const noCache={"Cache-Control":"private, no-store"};
const LIMIT=50;
const MAX_LIMIT=100;

type Point={lat:number;lng:number};
type CompanyRow={id:string;name:string|null;city:string|null;postcode:string|null;country:string|null;company_type:string|null;status:string|null;phone:string|null;created_at:string|null};
type DriverRow={id:string;company_id:string|null;display_name:string|null;status:string|null;availability_status:string|null};
type VehicleRow={company_id:string|null;assigned_driver_id:string|null;type:string|null;has_tail_lift:boolean|null;pallets_capacity:number|null;status:string|null};
type MemberRecord={
  id:string;kind:"company"|"driver";name:string;companyId:string|null;companyName:string|null;
  memberId:null;memberType:string;city:string|null;postcode:string|null;country:string|null;
  businessPhone:string|null;availability:string|null;vehicleTypes:string[];specialistServices:string[];
  maxPallets:number|null;distanceMiles:number|null;recordCreatedAt:string|null;
};
function safeQuery(value:string){return value.replace(/[^a-zA-Z0-9 -]/g,"").trim().slice(0,80)}
function numberArg(value:string|null,fallback:number,max:number){const n=Number(value);return value!==null&&Number.isInteger(n)?Math.max(0,Math.min(max,n)):fallback}
function memberType(value:string|null){const raw=(value||"").toLowerCase();if(raw.includes("broker"))return "Broker / Company";if(raw.includes("owner"))return "Owner Driver";if(raw.includes("carrier")||raw.includes("fleet"))return "Carrier / Fleet";if(raw.includes("customer")||raw.includes("shipper"))return "Customer / Shipper";return value?value.replace(/_/g," "):"Company"}
function postcodeKey(value:string|null){return (value||"").replace(/\s+/g,"").toUpperCase()}
function coordinates(result:{latitude?:unknown;longitude?:unknown}|null|undefined):Point|null{
  const lat=Number(result?.latitude),lng=Number(result?.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
function miles(a:Point,b:Point){const r=(n:number)=>n*Math.PI/180;const dLat=r(b.lat-a.lat),dLng=r(b.lng-a.lng);const h=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2;return 3958.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
function postcodeHint(value:string){const n=value.toUpperCase().replace(/\s+/g,"");if(/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(n))return {kind:"postcodes",value:n};if(/^[A-Z]{1,2}\d[A-Z\d]?$/.test(n))return {kind:"outcodes",value:n};return null;}
async function locationForSearch(value:string):Promise<Point|null>{
  const hint=postcodeHint(value);if(!hint)return null;
  try{const response=await fetch("https://api.postcodes.io/"+hint.kind+"/"+encodeURIComponent(hint.value),{signal:AbortSignal.timeout(5000),cache:"no-store"});
    if(!response.ok)return null;const data=await response.json() as {result?:{latitude?:number;longitude?:number}|null};return coordinates(data.result);
  }catch{return null}
}
async function locationForPostcodes(postcodes:string[]):Promise<Map<string,Point>>{
  const output=new Map<string,Point>();const unique=[...new Set(postcodes.map(p=>postcodeKey(p)).filter(p=>postcodeHint(p)?.kind==="postcodes"))];
  for(let i=0;i<unique.length;i+=100){
    try{const response=await fetch("https://api.postcodes.io/postcodes",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({postcodes:unique.slice(i,i+100)}),
      signal:AbortSignal.timeout(5000),cache:"no-store"
    });if(!response.ok)continue;
    const data=await response.json() as {result?:Array<{query?:string;result?:{latitude?:number;longitude?:number}|null}>};
    for(const row of data.result||[]){const point=coordinates(row.result);if(row.query&&point)output.set(postcodeKey(row.query),point)}
    }catch{ /* No unverified distance is displayed when postcode lookup fails. */ }
  }
  return output;
}
function vehicleInfo(vehicles:VehicleRow[]){
  const types=[...new Set(vehicles.map(v=>String(v.type||"").replace(/_/g," ")).filter(Boolean))];
  const services=[...new Set(vehicles.filter(v=>v.has_tail_lift===true).map(()=>"Tail lift"))];
  const palletValues=vehicles.map(v=>Number(v.pallets_capacity)).filter(n=>Number.isFinite(n)&&n>0);
  return {types,services,maxPallets:palletValues.length?Math.max(...palletValues):null};
}
export async function GET(request:NextRequest){
  const member=await requireDemoMember(request);if(member instanceof NextResponse)return member;
  const q=safeQuery(request.nextUrl.searchParams.get("q")||"");
  const expanded=request.nextUrl.searchParams.get("mode")==="expanded";

  // Legacy minimal list is retained for existing Network & Tools KPIs and other consumers.
  if(!expanded){
    let query=member.db.from("companies").select("id,name,city,postcode,company_type,status").eq("status","active").order("name",{ascending:true}).limit(80);
    if(q)query=query.or("name.ilike.%"+q+"%,city.ilike.%"+q+"%,postcode.ilike.%"+q+"%");
    const {data,error}=await query;
    if(error)return NextResponse.json({error:"Directory unavailable under member permissions"},{status:503,headers:noCache});
    return NextResponse.json((data||[]).map(c=>({id:c.id,name:c.name,area:[c.city,c.postcode?.split(" ")[0]].filter(Boolean).join(" "),type:c.company_type||"Company"})),{headers:noCache});
  }

  const limit=numberArg(request.nextUrl.searchParams.get("limit"),LIMIT,MAX_LIMIT)||LIMIT;
  const offset=numberArg(request.nextUrl.searchParams.get("offset"),0,5000);
  const near=(request.nextUrl.searchParams.get("near")||"").trim().slice(0,16);
  const radius=numberArg(request.nextUrl.searchParams.get("radiusMiles"),10,300)||10;
  if(near&&!postcodeHint(near))return NextResponse.json({error:"Enter a valid UK postcode or outcode for nearest search."},{status:400,headers:noCache});
  const nearPoint=near?await locationForSearch(near):null;
  if(near&&!nearPoint)return NextResponse.json({error:"Nearest-search postcode could not be resolved. Other directory filters are still available."},{status:422,headers:noCache});

  let companiesQuery=member.db.from("companies").select("id,name,city,postcode,country,company_type,status,phone,created_at").eq("status","active").order("name",{ascending:true}).range(offset,offset+limit);
  let driversQuery=member.db.from("drivers").select("id,company_id,display_name,status,availability_status").eq("status","active").order("display_name",{ascending:true}).range(offset,offset+limit);
  if(q)companiesQuery=companiesQuery.or("name.ilike.%"+q+"%,city.ilike.%"+q+"%,postcode.ilike.%"+q+"%");
  const companyResult=await companiesQuery;
  if(q){
    // A town/postcode/company search must also find drivers belonging to matching visible companies.
    const matchedCompanyIds=(companyResult.data||[]).map(c=>c.id).filter((id):id is string=>typeof id==="string");
    driversQuery=matchedCompanyIds.length
      ?driversQuery.or("display_name.ilike.%"+q+"%,company_id.in.("+matchedCompanyIds.join(",")+")")
      :driversQuery.ilike("display_name","%"+q+"%");
  }
  const driverResult=await driversQuery;
  const warnings:string[]=[];
  if(companyResult.error&&driverResult.error)return NextResponse.json({error:"Directory records are unavailable to this staging member."},{status:503,headers:noCache});
  if(companyResult.error)warnings.push("Company records are unavailable under the current staging permissions.");
  if(driverResult.error)warnings.push("Driver records are unavailable under the current staging permissions.");
  const companyPage=((companyResult.data||[]) as CompanyRow[]);
  const driverPage=((driverResult.data||[]) as DriverRow[]);
  const hasMoreCompanies=companyPage.length>limit,hasMoreDrivers=driverPage.length>limit;
  const companies=companyPage.slice(0,limit),drivers=driverPage.slice(0,limit);
  const companyIds=[...new Set([...companies.map(c=>c.id),...drivers.map(d=>d.company_id).filter((v):v is string=>Boolean(v))])];
  let vehicles:VehicleRow[]=[];
  if(companyIds.length){
    const vehicleResult=await member.db.from("vehicles").select("company_id,assigned_driver_id,type,has_tail_lift,pallets_capacity,status").in("company_id",companyIds).limit(500);
    if(vehicleResult.error)warnings.push("Vehicle capabilities could not be loaded under current staging permissions.");
    else{
      vehicles=(vehicleResult.data||[]) as VehicleRow[];
      if(vehicles.length===500)warnings.push("Vehicle enrichment is capped; some capabilities may be missing.");
    }
  }
  const companyById=new Map<string,CompanyRow>(companies.map(c=>[c.id,c]));
  const missingCompanyIds=drivers.map(d=>d.company_id).filter((id):id is string=>typeof id==="string"&&id.length>0&&!companyById.has(id));
  if(missingCompanyIds.length){
    // Related company details remain subject to the same JWT-scoped RLS restrictions.
    const related=await member.db.from("companies").select("id,name,city,postcode,country,company_type,status,phone,created_at")
      .in("id",[...new Set(missingCompanyIds)]).eq("status","active").limit(100);
    if(!related.error)for(const row of (related.data||[]) as CompanyRow[])companyById.set(row.id,row);
  }
  const companyVehicles=new Map<string,VehicleRow[]>(),driverVehicles=new Map<string,VehicleRow[]>();
  for(const vehicle of vehicles){
    if(vehicle.company_id)companyVehicles.set(vehicle.company_id,[...(companyVehicles.get(vehicle.company_id)||[]),vehicle]);
    if(vehicle.assigned_driver_id)driverVehicles.set(vehicle.assigned_driver_id,[...(driverVehicles.get(vehicle.assigned_driver_id)||[]),vehicle]);
  }
  const coords=nearPoint?await locationForPostcodes([...companyById.values()].map(c=>c.postcode||"")):new Map<string,Point>();
  const distance=(postcode:string|null)=>{if(!nearPoint)return null;const target=coords.get(postcodeKey(postcode));return target?Number(miles(nearPoint,target).toFixed(1)):null};
  const companyRecords:MemberRecord[]=companies.map(c=>{
    const v=vehicleInfo(companyVehicles.get(c.id)||[]);
    return {id:c.id,kind:"company",name:c.name||"Company name unavailable",companyId:c.id,companyName:c.name||null,
      memberId:null,memberType:memberType(c.company_type),city:c.city||null,postcode:c.postcode||null,country:c.country||null,
      businessPhone:c.phone||null,availability:null,vehicleTypes:v.types,specialistServices:v.services,
      maxPallets:v.maxPallets,distanceMiles:distance(c.postcode),recordCreatedAt:c.created_at||null};
  });
  const driverRecords:MemberRecord[]=drivers.map(d=>{
    const company=companyById.get(d.company_id||"");
    const v=vehicleInfo(driverVehicles.get(d.id)||[]);
    return {id:d.id,kind:"driver",name:d.display_name||"Driver name unavailable",companyId:d.company_id||null,
      companyName:company?.name||null,memberId:null,memberType:"Driver",city:company?.city||null,
      postcode:company?.postcode||null,country:company?.country||null,businessPhone:null,
      availability:d.availability_status||null,vehicleTypes:v.types,specialistServices:v.services,
      maxPallets:v.maxPallets,distanceMiles:distance(company?.postcode||null),recordCreatedAt:null};
  });
  const within=(row:MemberRecord)=>!near||row.distanceMiles!==null&&row.distanceMiles<=radius;
  return NextResponse.json({
    companies:companyRecords.filter(within),drivers:driverRecords.filter(within),
    paging:{nextOffset:offset+limit,hasMoreCompanies,hasMoreDrivers,limit,partial:hasMoreCompanies||hasMoreDrivers},
    nearest:near?{near,radiusMiles:radius,locationType:"Postcode-centre approximation",resolved:true}:null,
    warnings,privacy:"Only member records allowed by Staging RLS are returned. Driver locations are company-level, not GPS.",
    memberIdsAvailable:false,
  },{headers:noCache});
}
