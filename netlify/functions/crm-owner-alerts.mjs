/**
 * Internal business-day CRM reminders, XDrive Production only.
 * Netlify Scheduled Function: no public URL and no outbound marketing.
 */
import { createClient } from '@supabase/supabase-js';
export const config = { schedule: '0 8 * * 1-5' };
export default async function crmOwnerAlerts() {
  const dbUrl=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(process.env.CONTEXT!=='production' ||
      process.env.XDRIVE_CRM_SCHEDULED_ALERTS!=='enabled' ||
      process.env.XDRIVE_CRM_DATABASE_SCOPE!=='production_xdrive' ||
      dbUrl!=='https://jqxlauexhkonixtjvljw.supabase.co' || !key) {
    console.info('CRM scheduled alerts skipped: Production-only gate unavailable.');
    return new Response(null,{status:204});
  }
  const db=createClient(dbUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc('crm_emit_due_owner_alerts');
  if(error) {
    console.error('CRM owner alert RPC unavailable:',error.code||'unknown');
    return new Response('CRM owner alert delivery unavailable',{status:503});
  }
  console.info('CRM owner reminders: '+JSON.stringify({
    followups_notified:data?.followups_notified??0,
    privacy_notified:data?.privacy_notified??0,
  }));
  return new Response(null,{status:204});
}
