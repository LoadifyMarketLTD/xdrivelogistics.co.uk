import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Service not available.' });

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: { user }, error: authError } = await validator.auth.getUser(token);
  if (authError || !user) return json(401, { error: 'Unauthorized.' });

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id,role_in_company')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher']);

  if (membershipError) return json(500, { error: 'Buyer memberships could not be resolved.' });
  const companyIds = [...new Set((memberships ?? []).map((row) => row.company_id as string).filter(Boolean))];
  if (!companyIds.length) return json(200, { offers: [] });

  const { data: offers, error: offersError } = await supabaseAdmin
    .from('job_booking_offers')
    .select('id,job_id,bid_id,buyer_company_id,carrier_company_id,bidder_user_id,bidder_driver_id,quoted_vehicle_id,quoted_amount,currency,status,offered_at,responded_at,decline_reason,commercial_agreement_id')
    .in('buyer_company_id', companyIds)
    .order('offered_at', { ascending: false })
    .limit(250);

  if (offersError) {
    if (offersError.code === '42P01' || offersError.code === 'PGRST205') {
      return json(503, { error: 'Booking acceptance schema is not deployed yet.' });
    }
    return json(500, { error: offersError.message });
  }

  return json(200, { offers: offers ?? [] });
}
