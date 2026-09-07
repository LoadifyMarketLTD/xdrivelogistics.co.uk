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
    .select('id,status,current_status,pickup_location,pickup_postcode,delivery_location,delivery_postcode,client_name,vehicle_type,requested_vehicle_label,cargo_type,requested_cargo_label,budget_amount,exchange_visibility,awarded_carrier_company_id,assigned_driver_id,created_at,updated_at', { count: 'exact' })
    .eq('company_id', XDRIVE_COMPANY_ID)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return respond(500, { error: error.message });
  if (typeof count !== 'number') return respond(500, { error: 'XDrive jobs source returned an incomplete exact count.' });

  const rows = data ?? [];
  return respond(200, {
    rows,
    summary: {
      total_jobs: count,
      active_on_page: rows.filter((row) => !['delivered', 'cancelled', 'completed'].includes(String(row.current_status ?? row.status ?? '').toLowerCase())).length,
      marketplace_on_page: rows.filter((row) => String(row.exchange_visibility ?? '').toLowerCase() === 'exchange').length,
    },
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit), hasNextPage: to + 1 < count, hasPrevPage: page > 1 },
  });
}
