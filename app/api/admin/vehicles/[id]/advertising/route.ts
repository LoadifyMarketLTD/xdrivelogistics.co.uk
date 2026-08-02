import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, supabaseValidator } from '../../../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const requestSchema = z.object({
  state: z.enum(['none', 'exchange', 'partner']),
  reason: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  || process.env.SUPABASE_URL?.trim()
  || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

const json = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseValidator) {
    return json(503, { error: 'Authentication service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Missing bearer token.' });

  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Invalid session.' });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid request payload.' });
  }

  const params = await context.params;
  const vehicleId = params.id?.trim();
  if (!vehicleId) return json(400, { error: 'Vehicle id is required.' });

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } },
  });

  const { data, error } = await client.rpc('set_vehicle_advertising_state', {
    p_vehicle_id: vehicleId,
    p_actor_user_id: authData.user.id,
    p_state: parsed.data.state,
    p_reason: parsed.data.reason ?? null,
    p_metadata: parsed.data.metadata ?? { source: 'admin_vehicles_page' },
  });

  if (error) {
    const status = error.code === '42501' ? 403 : error.code === '22023' || error.code === '23514' ? 400 : 500;
    return json(status, { error: error.message || 'Unable to update advertising state.' });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return json(500, { error: 'No response from advertising update.' });

  return json(200, {
    vehicleId: row.vehicle_id,
    companyId: row.company_id,
    previousState: row.previous_state,
    newState: row.new_state,
  });
}
