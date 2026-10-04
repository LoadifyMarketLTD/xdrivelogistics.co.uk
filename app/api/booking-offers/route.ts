import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../_lib/supabaseAdmin';
import { inspectJobEnvironmentalZones } from '../../../lib/environmentalZone';
import { publicQuoteNotes } from '../driver/_lib/marketplacePublic';

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
    jobIds.length ? supabaseAdmin.from('jobs').select('id,pickup_location,pickup_postcode,delivery_location,delivery_postcode,pickup_datetime,delivery_datetime,payment_terms,load_id,load_ref,load_reference,booking_reference,customer_reference,vehicle_type,requested_vehicle_label,job_distance_miles,job_distance_minutes,load_details,pickup_lat,pickup_lng,delivery_lat,delivery_lng').in('id', jobIds) : Promise.resolve({ data: [] }),
    buyerIds.length ? supabaseAdmin.from('companies').select('id,name,xd_id').in('id', buyerIds) : Promise.resolve({ data: [] }),
  ]);
  const jobById = new Map((jobs ?? []).map((row) => [row.id as string, row]));
  const buyerById = new Map((buyers ?? []).map((row) => [row.id as string, row]));

  return json(200, {
    offers: (offers ?? []).map((offer) => {
      const job = jobById.get(offer.job_id as string) ?? null;
      const buyer = buyerById.get(offer.buyer_company_id as string) ?? null;
      const zones = inspectJobEnvironmentalZones(job);
      const zoneLabel = zones.pickup?.zone === 'ULEZ' || zones.delivery?.zone === 'ULEZ'
        ? 'London ULEZ'
        : zones.pickup?.zone === 'CAZ' || zones.delivery?.zone === 'CAZ'
          ? 'Clean Air Zone'
          : null;
      return {
        ...offer,
        buyer_name: buyer?.name ?? 'Transport buyer',
        buyer_xd_id: buyer?.xd_id ?? null,
        public_reference: 'XDL-' + String(offer.job_id ?? '').slice(0, 8).toUpperCase(), 
        environmental_zone: zoneLabel,
        public_quote_notes: publicQuoteNotes(job?.load_details),
        job,
      };
    }),
  });
}
