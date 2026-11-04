import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const respond = (status:number, body:Record<string,unknown>) =>
  NextResponse.json(body,{status,headers:{'Cache-Control':'no-store, max-age=0'}});

type Journey = {
  id:string; company_id:string; from_postcode:string|null; to_postcode:string|null;
  available_from:string|null; available_to:string|null; status:string|null;
  vehicle_type:string|null; created_at:string|null;
};

const publicOutcode = (value:string|null) => {
  const compact=(value??'').trim().toUpperCase().replace(/\s+/g,'');
  const match=compact.match(/^([A-Z]{1,2}[0-9][0-9A-Z]?)(?:[0-9][A-Z]{2})?$/);
  return match?.[1] ?? 'Location not published';
};

/** Authenticated marketplace return offers only; no driver identity, full
 * postcodes, private instructions, signature, phone or private route metadata.
 */
export async function GET(request:NextRequest) {
  if(!isSupabaseAdminConfigured||!supabaseAdmin)return respond(503,{error:'Return Journeys unavailable.'});
  const token=getBearerToken(request);
  if(!token)return respond(401,{error:'Authentication required.'});
  const {data:auth,error:authError}=await supabaseAdmin.auth.getUser(token);
  if(authError||!auth.user)return respond(401,{error:'Authentication required.'});

  const {data:member,error:memberError}=await supabaseAdmin.from('company_memberships')
    .select('company_id').eq('user_id',auth.user.id).eq('status','active').limit(1).maybeSingle();
  if(memberError)return respond(503,{error:'Membership verification unavailable.'});
  if(!member)return respond(403,{error:'An active company membership is required.'});

  const {data,error}=await supabaseAdmin.from('return_journeys')
    .select('id,company_id,from_postcode,to_postcode,available_from,available_to,status,vehicle_type,created_at')
    .in('status',['active','available']).order('available_from',{ascending:true,nullsFirst:false}).limit(250);
  if(error)return respond(503,{error:'Verified return journeys could not be retrieved.'});
  const now=Date.now();
  const rows=((data??[]) as Journey[]).filter(row=>!row.available_to||new Date(row.available_to).getTime()>=now);
  const companyIds=[...new Set(rows.map(row=>row.company_id).filter(Boolean))];
  const companies=companyIds.length ? await supabaseAdmin.from('companies')
    .select('id,name,xd_id,status').in('id',companyIds).limit(250)
    : {data:[],error:null};
  if(companies.error)return respond(503,{error:'Return journey company identities unavailable.'});
  const members=new Map((companies.data??[]).filter(c=>c.status==='active').map(c=>[String(c.id),{name:c.name,code:c.xd_id}]));
  const published=rows.filter(row=>members.has(row.company_id)).map(row=>({
    id:row.id,
    from:publicOutcode(row.from_postcode),
    to:publicOutcode(row.to_postcode),
    availableFrom:row.available_from,
    availableTo:row.available_to,
    vehicleType:row.vehicle_type,
    member:members.get(row.company_id),
  }));
  return respond(200,{journeys:published,limited:(data??[]).length>=250,source:'published-return-journeys'});
}
