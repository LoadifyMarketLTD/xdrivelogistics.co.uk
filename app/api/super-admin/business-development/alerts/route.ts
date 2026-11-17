import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse } from '../_lib/server';
export const dynamic='force-dynamic';
/** Read-only owner alert receipt view, from the canonical in-app notification ledger. */
export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const {data,count,error}=await supabaseAdmin!.from('crm_owner_alert_receipts')
    .select('id,alert_kind,entity_id,trigger_date,created_at,notification_id',{count:'exact'})
    .order('created_at',{ascending:false}).limit(30);
  if(error || count===null)return crmResponse(503,{
    error:'CRM scheduled alert receipt source unavailable; do not infer zero alerts.'
  });
  return crmResponse(200,{
    total:count,alerts:data??[],
    schedule:'Business days at 08:00 UTC',
    delivery:'Internal owner-only notifications. No marketing email or SMS dispatched.',
  });
}
