import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { getBuyerViewMemberships } from '../../_lib/buyerVisibilityScope';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Service not available.' });

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: { user }, error: authError } = await validator.auth.getUser(token);
  if (authError || !user) return json(401, { error: 'Unauthorized.' });

  let memberships;
  try {memberships=await getBuyerViewMemberships(supabaseAdmin,user.id)}
  catch{return json(503,{error:'Buyer memberships could not be verified.'})}
  const companyIds=[...new Set(memberships.map(row=>row.company_id).filter(Boolean))];
  if (!companyIds.length) return json(200, { offers: [] });

  const pageParam = request.nextUrl.searchParams.get('page') ?? '0';
  if (!/^(0|[1-9]\d*)$/.test(pageParam) || Number(pageParam) > 10000) return json(400, { error: 'Invalid page.' });
  const page = Number(pageParam);
  const pageSize = 250;

  const { data: offers, error: offersError } = await supabaseAdmin
    .from('job_booking_offers')
    .select('id,job_id,bid_id,buyer_company_id,carrier_company_id,bidder_user_id,bidder_driver_id,quoted_vehicle_id,quoted_amount,currency,status,offered_at,responded_at,decline_reason,commercial_agreement_id')
    .in('buyer_company_id', companyIds)
    .order('offered_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize);

  if (offersError) {
    if (offersError.code === '42P01' || offersError.code === 'PGRST205') {
      return json(503, { error: 'Booking acceptance schema is not deployed yet.' });
    }
    return json(500, { error: offersError.message });
  }

  return json(200, { offers: (offers ?? []).slice(0, pageSize), page, hasMore: (offers ?? []).length > pageSize, nextPage: (offers ?? []).length > pageSize ? page + 1 : null });
}
