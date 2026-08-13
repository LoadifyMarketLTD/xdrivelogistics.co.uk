import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const XDRIVE_COMPANY_ID =
  process.env.XDRIVE_PUBLIC_INTAKE_COMPANY_ID?.trim() ||
  process.env.XDRIVE_DEFAULT_COMPANY_ID?.trim() ||
  process.env.DEFAULT_COMPANY_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID?.trim() ||
  '';

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role,status')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (profileError || !profile) return null;
  if (profile.role !== 'owner' || String(profile.status ?? '').toLowerCase() !== 'active') return null;
  return authData.user;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });
  if (!XDRIVE_COMPANY_ID) return respond(503, { error: 'XDrive company is not configured.' });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from('jobs')
    .select(
      'id,status,current_status,pickup_location,pickup_postcode,delivery_location,delivery_postcode,client_name,vehicle_type,requested_vehicle_label,cargo_type,requested_cargo_label,budget_amount,exchange_visibility,awarded_carrier_company_id,assigned_driver_id,created_at,updated_at',
      { count: 'exact' },
    )
    .eq('company_id', XDRIVE_COMPANY_ID)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return respond(500, { error: error.message });

  const rows = data ?? [];
  const total = count ?? rows.length;
  return respond(200, {
    rows,
    summary: {
      total_jobs: total,
      active_on_page: rows.filter((row) => !['delivered', 'cancelled', 'completed'].includes(String(row.current_status ?? row.status ?? '').toLowerCase())).length,
      marketplace_on_page: rows.filter((row) => String(row.exchange_visibility ?? '').toLowerCase() === 'exchange').length,
    },
    pagination: { page, limit, total, hasNextPage: to + 1 < total },
  });
}
