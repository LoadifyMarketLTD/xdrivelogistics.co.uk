import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { isTerminalStopStatus } from '../../../../../../../lib/jobs/driverStopExecution';
import { isDriverContext, requireDriver, respond } from '../../../_lib';

const ALLOWED_STATUS = new Set([
  'accepted','on_my_way','on_site_pickup','loaded','in_transit','on_site_delivery','delivered','completed',
]);

type StopRow = {
  id: string;
  sequence: number;
  stop_type: 'collection'|'delivery';
  status: 'pending'|'en_route'|'arrived'|'completed'|'cancelled'|'skipped';
  en_route_at: string|null;
  arrived_at: string|null;
  completed_at: string|null;
  handover: unknown;
};

const userScopedSupabase = (token: string) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const photoPaths = (handover: unknown) => {
  if (!handover || typeof handover !== 'object' || Array.isArray(handover)) return [] as string[];
  const value = (handover as Record<string, unknown>).photoPaths;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
};

async function loadStops(jobId: string) {
  const { data, error } = await supabaseAdmin!
    .from('job_stops')
    .select('id,sequence,stop_type,status,en_route_at,arrived_at,completed_at,handover')
    .eq('job_id', jobId)
    .order('sequence', { ascending: true });
  return { stops: (data ?? []) as unknown as StopRow[], error };
}

function validateBoundaryStop(nextStatus: string, stops: StopRow[]) {
  if (!stops.length) return { ok: true as const };
  const first = stops[0];
  const last = stops[stops.length - 1];

  if (nextStatus === 'on_site_pickup' && first.stop_type === 'collection' && first.status !== 'en_route' && first.status !== 'arrived') {
    return { ok: false as const, error: 'On My Way to Pickup must be recorded before On Site Pickup.' };
  }
  if (nextStatus === 'loaded' && first.stop_type === 'collection') {
    if (first.status !== 'arrived' && !isTerminalStopStatus(first.status)) {
      return { ok: false as const, error: 'On Site Pickup must be recorded before Loaded.' };
    }
    if (first.status === 'arrived' && photoPaths(first.handover).length < 1) {
      return { ok: false as const, error: 'At least one stop-scoped collection photo is required before Loaded.' };
    }
  }
  if (nextStatus === 'in_transit' && last.stop_type === 'delivery') {
    const middle = stops.slice(1, -1);
    if (middle.some(stop => !isTerminalStopStatus(stop.status))) {
      return { ok: false as const, error: 'Complete or resolve every intermediate stop before travelling to final delivery.' };
    }
    if (last.status !== 'pending' && last.status !== 'en_route') {
      return { ok: false as const, error: 'Final delivery stop is not ready for departure.' };
    }
  }
  if (nextStatus === 'on_site_delivery' && last.stop_type === 'delivery' && last.status !== 'en_route' && last.status !== 'arrived') {
    return { ok: false as const, error: 'On My Way to Final Delivery must be recorded before On Site Final Delivery.' };
  }
  if (nextStatus === 'delivered' && last.stop_type === 'delivery' && last.status !== 'completed') {
    return { ok: false as const, error: 'Complete and submit the final POD before marking the job Delivered.' };
  }
  return { ok: true as const };
}

async function applyBoundaryStop(jobId: string, nextStatus: string, stops: StopRow[]) {
  if (!stops.length) return { ok: true as const };
  const first = stops[0];
  const last = stops[stops.length - 1];
  const now = new Date().toISOString();
  let target: StopRow | null = null;
  let expected = '';
  let update: Record<string, unknown> | null = null;

  if (nextStatus === 'on_my_way' && first.stop_type === 'collection' && first.status === 'pending') {
    target = first; expected = 'pending'; update = { status: 'en_route', en_route_at: now, updated_at: now };
  } else if (nextStatus === 'on_site_pickup' && first.stop_type === 'collection' && first.status === 'en_route') {
    target = first; expected = 'en_route'; update = { status: 'arrived', arrived_at: now, updated_at: now };
  } else if (nextStatus === 'loaded' && first.stop_type === 'collection' && first.status === 'arrived') {
    target = first; expected = 'arrived'; update = { status: 'completed', completed_at: now, updated_at: now };
  } else if (nextStatus === 'in_transit' && last.stop_type === 'delivery' && last.status === 'pending') {
    target = last; expected = 'pending'; update = { status: 'en_route', en_route_at: now, updated_at: now };
  } else if (nextStatus === 'on_site_delivery' && last.stop_type === 'delivery' && last.status === 'en_route') {
    target = last; expected = 'en_route'; update = { status: 'arrived', arrived_at: now, updated_at: now };
  }

  if (!target || !update) return { ok: true as const };
  const { data: changed, error } = await supabaseAdmin!
    .from('job_stops').update(update)
    .eq('id', target.id).eq('job_id', jobId).eq('status', expected)
    .select('id').maybeSingle();
  if (error) return { ok: false as const, error: 'The boundary stop could not be synchronized.' };
  if (!changed) return { ok: false as const, error: 'The stop state changed. Refresh the booking and retry.' };
  return { ok: true as const };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const nextStatus = typeof body.nextStatus === 'string' ? body.nextStatus.trim().toLowerCase() : '';
  if (!ALLOWED_STATUS.has(nextStatus)) return respond(400, { error: 'Unsupported driver status.' });

  const stopState = await loadStops(id);
  if (stopState.error) return respond(503, { error: 'Booking stops could not be verified. Retry before changing status.' });

  const preflight = validateBoundaryStop(nextStatus, stopState.stops);
  if (!preflight.ok) return respond(409, { error: preflight.error });

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

  const refreshed = await loadStops(id);
  if (refreshed.error) return respond(503, { error: 'Lifecycle status was saved but the matching stop could not be refreshed.', lifecycleSaved: true });
  const sync = await applyBoundaryStop(id, nextStatus, refreshed.stops);
  if (!sync.ok) return respond(409, { error: sync.error, lifecycleSaved: true });

  return respond(200, { ok: true, result: data });
}
