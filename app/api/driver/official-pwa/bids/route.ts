import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { requireWebDriver } from '../../_lib/webDriver';
import { isDriverContext } from '../../mobile/_lib';

/** Personal driver quote history for the authenticated browser PWA. */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Driver quotes are temporarily unavailable.' }, { status: 503 });
  }
  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { data, error } = await supabaseAdmin
    .from('job_bids')
    .select('id,job_id,amount,bid_price_gbp,status,collect_within_minutes,message,created_at')
    .or(`bidder_user_id.eq.${driver.userId},bidder_driver_id.eq.${driver.driverId}`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: 'Could not load driver quotes.' }, { status: 503 });
  return NextResponse.json({
    bids: (data ?? []).map(bid => ({
      id: bid.id,
      jobId: bid.job_id,
      amount: Number(bid.bid_price_gbp ?? bid.amount ?? 0),
      status: bid.status ?? 'submitted',
      collectWithinMinutes: bid.collect_within_minutes ?? null,
      message: bid.message ?? '',
      createdAt: bid.created_at,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
