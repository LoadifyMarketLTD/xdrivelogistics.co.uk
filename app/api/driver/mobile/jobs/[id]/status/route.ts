import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { isDriverContext, requireDriver, respond } from '../../../_lib';

const ALLOWED_STATUS = new Set([
  'on_my_way',
  'on_site_pickup',
  'loaded',
  'in_transit',
  'on_site_delivery',
  'delivered',
  'completed',
]);

const userScopedSupabase = (token: string) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) {
    return respond(503, { error: 'The driver mobile app is currently disabled.' });
  }

  // requireDriver is the authoritative native security boundary. Once a native
  // binding exists it requires the current installation id and JWT session_id to
  // match driver_mobile_device_sessions before any mutation can proceed.
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const nextStatus = typeof body.nextStatus === 'string' ? body.nextStatus.trim().toLowerCase() : '';
  if (!ALLOWED_STATUS.has(nextStatus)) return respond(400, { error: 'Unsupported driver status.' });

  const scoped = userScopedSupabase(token);
  if (!scoped) return respond(503, { error: 'Authenticated lifecycle client is not configured.' });

  const { data, error } = await scoped.rpc('driver_update_job_status_atomic', {
    p_driver_id: driver.driverId,
    p_job_id: id,
    p_next_status: nextStatus,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : error.code === '23514' ? 409 : error.code === 'P0002' ? 404 : 500;
    return respond(status, { error: error.message });
  }

  return respond(200, { ok: true, result: data });
}
