import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return NextResponse.json({ error: 'Availability is temporarily unavailable.' }, { status: 503 });
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: memberships } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');
  const ownCompanies = new Set((memberships ?? []).map((row) => String(row.company_id ?? '')).filter(Boolean));

  const { data, error } = await supabaseAdmin
    .from('driver_availability_presence')
    .select('driver_id, company_id, visibility, exact_lat, exact_lng, exchange_lat, exchange_lng, available_until, recorded_at')
    .gt('available_until', new Date().toISOString())
    .in('visibility', ['fleet', 'exchange'])
    .order('recorded_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: 'Availability locations could not be loaded.' }, { status: 500 });

  const positions = (data ?? []).flatMap((row) => {
    const companyId = row.company_id ? String(row.company_id) : null;
    const sameCompany = Boolean(companyId && ownCompanies.has(companyId));
    if (sameCompany) {
      return [{
        driver_id: row.driver_id,
        scope: 'fleet',
        lat: Number(row.exact_lat),
        lng: Number(row.exact_lng),
        available_until: row.available_until,
        recorded_at: row.recorded_at,
      }];
    }
    if (row.visibility !== 'exchange') return [];
    return [{
      driver_id: row.driver_id,
      scope: 'exchange',
      lat: Number(row.exchange_lat),
      lng: Number(row.exchange_lng),
      available_until: row.available_until,
      recorded_at: row.recorded_at,
    }];
  });

  return NextResponse.json({ positions }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
