import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, supabaseValidator } from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

const toLabel = (eventType: unknown): string => {
  const text = typeof eventType === 'string' ? eventType.trim() : '';
  if (!text) return 'Activity update';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const toReference = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const raw =
    (typeof data.job_ref === 'string' && data.job_ref)
    || (typeof data.invoice_number === 'string' && data.invoice_number)
    || (typeof data.customer_reference === 'string' && data.customer_reference)
    || null;
  if (!raw) return null;
  const value = raw.trim().replace(/\s+/g, ' ');
  return value.length > 18 ? value.slice(0, 18) : value;
};

const toEntityId = (
  entityId: unknown,
  payload: unknown,
): string | null => {
  if (typeof entityId === 'string' && entityId.trim()) return entityId.trim();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const raw =
    (typeof data.job_id === 'string' && data.job_id)
    || (typeof data.invoice_id === 'string' && data.invoice_id)
    || (typeof data.bid_id === 'string' && data.bid_id)
    || null;
  return raw ? raw.trim() : null;
};

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseValidator) {
    return json(503, { error: 'Authentication service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Missing bearer token.' });

  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Invalid session.' });

  const limitValue = Number(new URL(request.url).searchParams.get('limit') ?? '12');
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(20, Math.trunc(limitValue))) : 12;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } },
  });

  const { data, error } = await client
    .from('notification_events')
    .select('id, event_type, entity_type, entity_id, payload, created_at')
    .eq('recipient_user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return json(500, { error: 'Unable to load activity feed.' });
  }

  const items = (data ?? []).map((row, index) => ({
    id: `${String(row.created_at ?? 'event')}-${index}`,
    label: toLabel(row.event_type),
    reference: toReference(row.payload),
    entity_type: typeof row.entity_type === 'string' ? row.entity_type : null,
    entity_id: toEntityId(row.entity_id, row.payload),
    event_id: typeof row.id === 'string' ? row.id : null,
    created_at: row.created_at,
  }));

  return json(200, { items });
}
