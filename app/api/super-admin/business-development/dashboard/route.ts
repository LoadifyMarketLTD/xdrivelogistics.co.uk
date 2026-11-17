import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse } from '../_lib/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authorizeCrm(request);
  if (auth.error) return auth.error;
  // All figures are live database counts, not projections or synthetic leads.
  const stages = ['discovered','researching','qualified','contacted','replied','onboarding','converted','disqualified'] as const;
  const segments = ['customer','broker','forwarder','carrier','mixed'] as const;
  const now = new Date().toISOString();
  const count = async (table: 'crm_prospect_organisations' | 'crm_prospect_contacts' | 'crm_campaign_drafts',
                       field?: string, value?: string, overdue = false): Promise<number> => {
    let q = supabaseAdmin!.from(table).select('*', { count: 'exact', head: true });
    if (field && value) q = q.eq(field, value);
    if (overdue) q = q.lte('next_follow_up_at', now).not('next_follow_up_at','is',null)
      .not('status','in','(converted,disqualified)');
    const { count: n, error } = await q;
    if (error || n === null) throw Error('CRM metrics query failed');
    return n;
  };
  const eventCount = async (eventType:string):Promise<number> => {
    const {count,error}=await supabaseAdmin!.from('crm_prospect_events')
      .select('*',{count:'exact',head:true}).eq('event_type',eventType);
    if(error || count===null)throw Error('CRM activity count failed');
    return count;
  };
  try {
    const [total, contacts, campaigns, overdue, byStage, bySegment,
      recordedReplies, recordedCallAttempts, recordedMeetings] = await Promise.all([
      count('crm_prospect_organisations'),
      count('crm_prospect_contacts'),
      count('crm_campaign_drafts'),
      count('crm_prospect_organisations', undefined, undefined, true),
      Promise.all(stages.map(async stage => [stage, await count('crm_prospect_organisations','status',stage)] as const)),
      Promise.all(segments.map(async segment => [segment, await count('crm_prospect_organisations','segment',segment)] as const)),
      eventCount('reply_received'),eventCount('call_attempted'),eventCount('meeting_scheduled'),
    ]);
    return crmResponse(200, {
      observed_at: now, organisations: total, contacts, campaign_drafts: campaigns,
      follow_ups_due: overdue, by_status: Object.fromEntries(byStage), by_segment: Object.fromEntries(bySegment),
      recorded_reply_events:recordedReplies,recorded_call_attempts:recordedCallAttempts,
      recorded_meetings:recordedMeetings,verified_member_conversions:
        Object.fromEntries(byStage).converted ?? 0,
      real_jobs_attributed: null, real_bookings_attributed: null,
      caveat: 'CRM counts only; no marketplace activity or conversions inferred.',
    });
  } catch {
    return crmResponse(503, { error: 'CRM metrics unavailable; staging schema may be missing.' });
  }
}
