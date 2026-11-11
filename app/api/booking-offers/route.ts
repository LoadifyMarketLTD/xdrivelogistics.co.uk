import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../_lib/supabaseAdmin';
import { inspectJobEnvironmentalZones } from '../../../lib/environmentalZone';
import { publicQuoteNotes } from '../driver/_lib/marketplacePublic';
import { bookingOfferVisibleJob } from '../_lib/bookingOfferPublicProjection';

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
    .select('company_id,role_in_company')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (membershipError) return json(500, { error: 'Carrier memberships could not be resolved.' });
  // Company-wide commercial offers are visible only to company decision-makers.
  // Company Drivers see only offers addressed to their own user account.
  const companyIds = (memberships ?? []).filter(row=>['owner','admin','dispatcher'].includes(String(row.role_in_company??'').toLowerCase())).map(row=>row.company_id as string).filter(Boolean);

  const {data:driverRows,error:driverError}=await supabaseAdmin.from('drivers').select('id').eq('user_id',user.id);
  if(driverError)return json(503,{error:'Driver identity could not be verified.'});
  const assignedDriverIds=(driverRows??[]).map(row=>row.id as string).filter(Boolean);

  const pageParam = request.nextUrl.searchParams.get('page') ?? '0';
  if (!/^(0|[1-9]\d*)$/.test(pageParam) || Number(pageParam) > 10000) return json(400, { error: 'Invalid page.' });
  const page = Number(pageParam);
  const pageSize = 100;
  const filters = [`bidder_user_id.eq.${user.id}`];
  if(assignedDriverIds.length)filters.push(`bidder_driver_id.in.(${assignedDriverIds.join(',')})`);
  if (companyIds.length) filters.push(`carrier_company_id.in.(${companyIds.join(',')})`);
  const { data: offers, error: offersError } = await supabaseAdmin
    .from('job_booking_offers')
    .select('id,job_id,bid_id,buyer_company_id,carrier_company_id,bidder_user_id,bidder_driver_id,quoted_vehicle_id,quoted_amount,currency,status,offered_at,responded_at,decline_reason,commercial_agreement_id')
    .or(filters.join(','))
    .order('offered_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize);
  if (offersError) {
    if (offersError.code === '42P01' || offersError.code === 'PGRST205') return json(503, { error: 'Booking acceptance schema is not deployed yet.' });
    return json(500, { error: offersError.message });
  }

  const jobIds = [...new Set((offers ?? []).map((offer) => offer.job_id as string))];
  const buyerIds = [...new Set((offers ?? []).map((offer) => offer.buyer_company_id as string))];
  const [{ data: jobs, error: jobsError }, { data: buyers, error: buyersError }] = await Promise.all([
    jobIds.length ? supabaseAdmin.from('jobs').select('id,current_status,pickup_location,pickup_city,pickup_postcode,delivery_location,delivery_city,delivery_postcode,pickup_datetime,delivery_datetime,payment_terms,load_id,load_ref,load_reference,booking_reference,customer_reference,vehicle_type,requested_vehicle_label,job_distance_miles,job_distance_minutes,load_details,pickup_lat,pickup_lng,delivery_lat,delivery_lng').in('id', jobIds) : Promise.resolve({ data: [], error: null }),
    buyerIds.length ? supabaseAdmin.from('companies').select('id,name,xd_id').in('id', buyerIds) : Promise.resolve({ data: [], error: null }),
  ]);
  // A partial database failure must not be represented as a successful, empty booking.
  // The driver needs the real route and buyer identity to decide on an offer.
  if (jobsError || buyersError) return json(503, { error: 'Booking details are temporarily unavailable.' });
  const jobById = new Map((jobs ?? []).map((row) => [row.id as string, row]));
  const buyerById = new Map((buyers ?? []).map((row) => [row.id as string, row]));
  if (jobIds.some((id) => !jobById.has(id))) return json(503, { error: 'Some booking jobs could not be resolved.' });

  return json(200, {
    page, hasMore: (offers ?? []).length > pageSize, nextPage: (offers ?? []).length > pageSize ? page + 1 : null,
    offers: (offers ?? []).slice(0, pageSize).map((offer) => {
      const job = jobById.get(offer.job_id as string) ?? null;
      const buyer = buyerById.get(offer.buyer_company_id as string) ?? null;
      const zones = inspectJobEnvironmentalZones(job);
      const zoneLabel = Array.from(new Set([zones.pickup?.label, zones.delivery?.label].filter((value): value is string => Boolean(value)))).join(' + ') || null;
      return {
        ...offer,
        buyer_name: buyer?.name ?? 'Transport buyer',
        buyer_xd_id: buyer?.xd_id ?? null,
        public_reference: 'XDL-' + String(offer.job_id ?? '').slice(0, 8).toUpperCase(), 
        environmental_zone: zoneLabel,
        public_quote_notes: publicQuoteNotes(job?.load_details),
        job: bookingOfferVisibleJob(job, String(offer.status)),
      };
    }),
  });
}
