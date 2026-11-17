import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse, crmUuid } from '../_lib/server';

export const dynamic = 'force-dynamic';

// Read-only CRM activity history. The atomic follow-up workflow owns all
// activity insertion and status transitions so parallel editors cannot disagree.
export async function GET(request: NextRequest) {
  const auth = await authorizeCrm(request);
  if (auth.error) return auth.error;
  const organisationId = request.nextUrl.searchParams.get('organisation_id');
  if (!crmUuid(organisationId))
    return crmResponse(400, { error: 'Valid organisation ID required.' });
  const { data, error } = await supabaseAdmin!.from('crm_prospect_events')
    .select('id,organisation_id,contact_id,channel,event_type,occurred_at,note')
    .eq('organisation_id', organisationId)
    .order('occurred_at', { ascending: false }).limit(100);
  if (error) return crmResponse(503, { error: 'CRM activity unavailable.' });
  return crmResponse(200, { events: data ?? [], read_only: true });
}
