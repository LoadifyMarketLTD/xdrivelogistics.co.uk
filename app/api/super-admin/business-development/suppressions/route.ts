import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { hasSuperAdminBearerAuthorization, verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

export const dynamic = 'force-dynamic';
const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
const channels = new Set(['email', 'phone', 'all']);
const reasons = new Set(['objection', 'opt_out', 'invalid', 'legal_hold', 'other']);

async function authorize(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { error: respond(503, { error: 'CRM storage unavailable.' }) };
  if (!hasSuperAdminBearerAuthorization(request)) return { error: respond(401, { error: 'Authentication required.' }) };
  const owner = await verifyPlatformOwner(request);
  if (!owner) return { error: respond(403, { error: 'Active Platform Owner required or preview write disabled.' }) };
  return { owner };
}

export function normalizeSuppressionValue(channel: string, raw: string): string | null {
  const trimmed = raw.trim();
  if (channel === 'email') {
    const email = trimmed.toLowerCase();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }
  if (channel === 'phone') {
    const phone = trimmed.replace(/[\s().-]/g, '');
    return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const { data, error } = await supabaseAdmin!
    .from('crm_prospect_suppressions')
    .select('id,channel,normalized_contact_value,reason,source,recorded_at')
    .order('recorded_at', { ascending: false }).limit(100);
  if (error) return respond(503, { error: 'Suppression registry unavailable.' });
  return respond(200, { suppressions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid');
    body = value as Record<string, unknown>;
  } catch { return respond(400, { error: 'Invalid JSON object.' }); }
  const channel = String(body.channel ?? '');
  const reason = String(body.reason ?? '');
  const raw = typeof body.contact_value === 'string' ? body.contact_value : '';
  const source = typeof body.source === 'string' ? body.source.trim() : '';
  // An 'all' channel cannot be normalized safely without identifying the identifier type.
  // To suppress both email and phone, record separate channel-specific entries.
  if (!channels.has(channel) || channel === 'all' || !reasons.has(reason) ||
    !source || source.length > 500 || !raw || raw.length > 300) {
    return respond(400, { error: 'Valid channel, contact value, reason and evidence source required.' });
  }
  const normalized = normalizeSuppressionValue(channel, raw);
  if (!normalized) return respond(400, { error: 'Contact value must be a valid email or international E.164 phone number.' });
  // Upsert never deletes suppression records; repeated objections stay suppressed.
  const { data, error } = await supabaseAdmin!
    .from('crm_prospect_suppressions')
    .upsert({ channel, normalized_contact_value: normalized, reason, source },
      { onConflict: 'channel,normalized_contact_value', ignoreDuplicates: true })
    .select('id,channel,normalized_contact_value,reason,source,recorded_at')
    .maybeSingle();
  if (error) return respond(503, { error: 'Unable to record suppression.' });
  return respond(200, { suppression: data ?? null, alreadySuppressed: data === null });
}
