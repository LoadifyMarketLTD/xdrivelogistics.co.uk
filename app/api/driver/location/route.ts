import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { parseDriverLocationPayload } from '../../../../lib/driverLocation';

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

  const [{ data: driverRow, error: driverError }, { data: profileRow, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('drivers')
      .select('id, company_id, app_access, status')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);

  if (driverError) {
    return NextResponse.json({ error: driverError.message }, { status: 500 });
  }
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!driverRow) {
    return NextResponse.json({ error: 'Driver record not found.' }, { status: 403 });
  }
  if (String(profileRow?.status ?? '').trim().toLowerCase() !== 'active') {
    return NextResponse.json({ error: 'Driver profile is not active.' }, { status: 403 });
  }
  if (driverRow.app_access !== true) {
    return NextResponse.json({ error: 'Driver app access has not been approved.' }, { status: 403 });
  }
  if (String(driverRow.status ?? '').trim().toLowerCase() !== 'active') {
    return NextResponse.json({ error: 'Driver account is not active.' }, { status: 403 });
  }

  let body: LocationPayload;
  try {
    body = (await request.json()) as LocationPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = parseDriverLocationPayload(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? 'Invalid driver location payload.' }, { status: 400 });
  }

  const { lat, lng, heading = null, speed_mph: speedMph = null } = parsed.data;

  const { error: insertError } = await supabaseAdmin
    .from('driver_locations')
    .insert({
      driver_id: driverRow.id,
      company_id: driverRow.company_id ?? null,
      lat,
      lng,
      heading,
      speed_mph: speedMph,
      recorded_at: new Date().toISOString(),
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
