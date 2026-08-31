import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const INTAKE_COMPANY_ID =
  process.env.XDRIVE_PUBLIC_INTAKE_COMPANY_ID?.trim() ||
  process.env.XDRIVE_DEFAULT_COMPANY_ID?.trim() ||
  process.env.DEFAULT_COMPANY_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID?.trim() ||
  '';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) {
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  if (!INTAKE_COMPANY_ID) {
    return respond(503, { error: 'XDrive intake company is not configured.' });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from('quotes')
    .select(
      'id,company_id,customer_name,customer_email,customer_phone,pickup_location,delivery_location,vehicle_type,cargo_type,amount,currency,status,notes,created_at',
      { count: 'exact' },
    )
    .eq('company_id', INTAKE_COMPANY_ID)
    .ilike('notes', '%SOURCE: app.xdrivelogistics.co.uk%')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return respond(500, { error: error.message });
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const newCount = rows.filter((row) => ['draft', 'new'].includes(String(row.status ?? '').toLowerCase())).length;
  const pricedCount = rows.filter((row) => typeof row.amount === 'number' && row.amount > 0).length;

  return respond(200, {
    rows,
    summary: {
      total_enquiries: total,
      new_or_draft_on_page: newCount,
      priced_on_page: pricedCount,
    },
    pagination: {
      page,
      limit,
      total,
      hasNextPage: to + 1 < total,
    },
  });
}
