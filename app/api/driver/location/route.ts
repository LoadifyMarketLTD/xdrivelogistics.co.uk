import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

type LocationPayload = {
  lat?: number;
  lng?: number;
  heading?: number | null;
  speed_mph?: number | null;
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve driver row from auth user
  const { data: driverRow, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (driverError || !driverRow) {
    return NextResponse.json({ error: 'Driver record not found.' }, { status: 403 });
  }

  let body: LocationPayload;
  try {
    body = (await request.json()) as LocationPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const lat = typeof body.lat === 'number' ? body.lat : null;
  const lng = typeof body.lng === 'number' ? body.lng : null;

  if (lat === null || lng === null) {
    return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Invalid lat/lng values.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error: insertError } = await supabaseAdmin
    .from('driver_locations')
    .insert({
      driver_id:  driverRow.id,
      company_id: driverRow.company_id,
      lat,
      lng,
      heading:    typeof body.heading === 'number' ? body.heading : null,
      speed_mph:  typeof body.speed_mph === 'number' ? body.speed_mph : null,
      recorded_at: now,
      updated_at:  now,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
