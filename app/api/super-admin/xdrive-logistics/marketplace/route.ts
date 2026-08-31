import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const XDRIVE_COMPANY_ID =
  process.env.XDRIVE_PUBLIC_INTAKE_COMPANY_ID?.trim() ||
  process.env.XDRIVE_DEFAULT_COMPANY_ID?.trim() ||
  process.env.DEFAULT_COMPANY_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID?.trim() ||
  '';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  if (!XDRIVE_COMPANY_ID) return respond(503, { error: 'XDrive company is not configured.' });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from('jobs')
    .select('id,status,current_status,pickup_location,delivery_location,client_name,requested_vehicle_label,vehicle_type,budget_amount,exchange_visibility,exchange_posted_at,exchange_expires_at,awarded_carrier_company_id,created_at', { count: 'exact' })
    .eq('company_id', XDRIVE_COMPANY_ID)
    .eq('exchange_visibility', 'exchange')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return respond(500, { error: error.message });
  const rows = data ?? [];
  const total = count ?? rows.length;

  const jobIds = rows.map((row) => row.id);
  const { data: bids, error: bidsError } = jobIds.length
    ? await supabaseAdmin.from('job_bids').select('job_id').in('job_id', jobIds)
    : { data: [], error: null };
  if (bidsError) return respond(500, { error: bidsError.message });

  const bidCount = new Map<string, number>();
  for (const bid of bids ?? []) bidCount.set(String(bid.job_id), (bidCount.get(String(bid.job_id)) ?? 0) + 1);

  return respond(200, {
    rows: rows.map((row) => ({ ...row, bids_count: bidCount.get(String(row.id)) ?? 0 })),
    summary: {
      total_marketplace_jobs: total,
      posted_on_page: rows.filter((row) => String(row.current_status ?? row.status ?? '').toLowerCase() === 'posted').length,
      awarded_on_page: rows.filter((row) => Boolean(row.awarded_carrier_company_id)).length,
    },
    pagination: { page, limit, total, hasNextPage: to + 1 < total },
  });
}
