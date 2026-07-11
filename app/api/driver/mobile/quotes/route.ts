import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond, toMoney } from '../_lib';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 60) || 60, 250);
  const statusFilter = searchParams.get('status');

  let query = supabaseAdmin
    .from('job_bids')
    .select(
      'id, status, bid_price_gbp, amount, message, created_at, jobs:job_id(id, pickup_location, delivery_location, pickup_datetime, delivery_datetime, vehicle_type, requested_vehicle_label, budget_amount, status)'
    )
    .eq('company_id', driver.companyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  type BidRow = {
    id: string;
    status: string;
    bid_price_gbp: number | null;
    amount: number | null;
    message: string | null;
    created_at: string | null;
    jobs: {
      id: string;
      pickup_location: string | null;
      delivery_location: string | null;
      pickup_datetime: string | null;
      delivery_datetime: string | null;
      vehicle_type: string | null;
      requested_vehicle_label: string | null;
      budget_amount: number | null;
      status: string | null;
    } | null;
  };

  const quotes = ((data ?? []) as unknown as BidRow[]).map((bid) => ({
    id: bid.id,
    status: bid.status,
    price: toMoney(bid.bid_price_gbp ?? bid.amount),
    message: bid.message,
    createdAt: bid.created_at,
    pickupLocation: bid.jobs?.pickup_location ?? 'Pickup TBC',
    deliveryLocation: bid.jobs?.delivery_location ?? 'Delivery TBC',
    pickupDatetime: bid.jobs?.pickup_datetime ?? null,
    vehicleType: bid.jobs?.requested_vehicle_label ?? bid.jobs?.vehicle_type ?? 'Vehicle TBC',
    jobStatus: bid.jobs?.status ?? null,
    jobId: bid.jobs?.id ?? null,
  }));

  return respond(200, { quotes });
}
