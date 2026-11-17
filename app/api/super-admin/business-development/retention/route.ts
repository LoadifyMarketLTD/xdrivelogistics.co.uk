import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse } from '../_lib/server';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const due=(request.nextUrl.searchParams.get('due')??'true')!=='false';
  let q=supabaseAdmin!.from('crm_prospect_contacts')
    .select('id,organisation_id,contact_kind,contact_status,collected_at,last_verified_at,retention_review_at,source_url');
  if(due)q=q.lte('retention_review_at',new Date().toISOString())
    .not('retention_review_at','is',null);
  const {data,error}=await q.order('retention_review_at',{ascending:true}).limit(100);
  if(error)return crmResponse(503,{error:'Retention review queue unavailable.'});
  return crmResponse(200,{due_only:due,contacts:data??[],
    note:'A review date is a human decision checkpoint, never an automatic deletion rule.'});
}
