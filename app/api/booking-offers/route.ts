import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Service not available.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: { user }, error } = await validator.auth.getUser(token);
  if (error || !user) return json(401, { error: 'Unauthorized.' });

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (membershipError) return json(500, { error: 'Carrier memberships could not be resolved.' });
  const companyIds = (memberships ?? []).map((row) => row.company_id as string).filter(Boolean);

  const filters = [`bidder_user_id.eq.${user.id}`];
  if (companyIds.length) filters.push(`carrier_company_id.in.(${companyIds.join(',')})`);
  const { data: offers, error: offersError } = await supabaseAdmin
    .from('job_booking_offers')
    .select('id,job_id,bid_id,buyer_company_id,carrier_company_id,bidder_user_id,bidder_driver_id,quoted_vehicle_id,quoted_amount,currency,status,offered_at,responded_at,decline_reason,commercial_agreement_id')
    .or(filters.join(','))
    .order('offered_at', { ascending: false })
    .limit(100);
  if (offersError) {
    if (offersError.code === '42P01' || offersError.code === 'PGRST205') return json(503, { error: 'Booking acceptance schema is not deployed yet.' });
    return json(500, { error: offersError.message });
  }

  const jobIds = [...new Set((offers ?? []).map((offer) => offer.job_id as string))];
  const buyerIds = [...new Set((offers ?? []).map((offer) => offer.buyer_company_id as string))];
  const [{ data: jobs }, { data: buyers }] = await Promise.all([
    jobIds.length ? supabaseAdmin.from('jobs').select('id,pickup_location,pickup_postcode,delivery_location,delivery_postcode,pickup_datetime,payment_terms,booking_reference,customer_reference,vehicle_type,requested_vehicle_label').in('id', jobIds) : Promise.resolve({ data: [] }),
    buyerIds.length ? supabaseAdmin.from('companies').select('id,name').in('id', buyerIds) : Promise.resolve({ data: [] }),
  ]);
  const jobById = new Map((jobs ?? []).map((row) => [row.id as string, row]));
  const buyerById = new Map((buyers ?? []).map((row) => [row.id as string, row.name as string]));

  return json(200, {
    offers: (offers ?? []).map((offer) => ({
      ...offer,
      buyer_name: buyerById.get(offer.buyer_company_id as string) ?? 'Transport buyer',
      job: jobById.get(offer.job_id as string) ?? null,
    })),
  });
}
