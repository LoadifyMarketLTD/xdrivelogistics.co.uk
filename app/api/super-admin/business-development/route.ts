import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '../../_lib/supabaseAdmin';
import { hasSuperAdminBearerAuthorization, verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

export const dynamic = 'force-dynamic';
const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
const legalForms = new Set(['ltd', 'llp', 'sole_trader', 'other', 'unknown']);
const segments = new Set(['customer', 'broker', 'forwarder', 'carrier', 'mixed']);
const isString = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
const optionalString = (v: unknown, max: number) => v == null || v === '' || isString(v, max);
const sourceUrl = (value: unknown) => {
  if (!isString(value, 2048)) return false;
  try { const url = new URL(value as string); return url.protocol === 'https:'; } catch { return false; }
};
async function authorize(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { error: respond(503, { error: 'CRM storage unavailable.' }) };
  if (!hasSuperAdminBearerAuthorization(request)) return { error: respond(401, { error: 'Authentication required.' }) };
  const owner = await verifyPlatformOwner(request);
  if (!owner) return { error: respond(403, { error: 'Active Platform Owner required or preview write disabled.' }) };
  return { owner };
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const page = Number(request.nextUrl.searchParams.get('page') ?? '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return respond(400, { error: 'Invalid page.' });
  const limit = 25;
  const { data, count, error } = await supabaseAdmin!
    .from('crm_prospect_organisations')
    .select('id,legal_name,company_number,website,legal_form,segment,status,source_url,source_checked_at,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) return respond(503, { error: 'CRM records unavailable; migration may not be applied.' });
  return respond(200, { organisations: data ?? [], total: count ?? 0, page, limit });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON');
    body = parsed as Record<string, unknown>;
  } catch { return respond(400, { error: 'Invalid JSON object.' }); }
  if (!isString(body.legal_name, 240) || (body.legal_name as string).trim().length < 2
    || !optionalString(body.company_number, 32) || !optionalString(body.website, 2048)
    || !legalForms.has(String(body.legal_form)) || !segments.has(String(body.segment))
    || !sourceUrl(body.source_url)) return respond(400, { error: 'Invalid prospect fields or missing HTTPS provenance.' });
  if (body.website && !sourceUrl(body.website)) return respond(400, { error: 'Website must be HTTPS.' });
  const { data, error } = await supabaseAdmin!
    .from('crm_prospect_organisations')
    .insert({
      legal_name: (body.legal_name as string).trim(),
      company_number: typeof body.company_number === 'string' ? body.company_number.trim().toUpperCase() || null : null,
      website: typeof body.website === 'string' ? body.website.trim() || null : null,
      legal_form: body.legal_form, segment: body.segment,
      source_url: (body.source_url as string).trim(),
      source_checked_at: new Date().toISOString(), created_by: auth.owner!.id,
    })
    .select('id,legal_name,company_number,legal_form,segment,status,created_at')
    .single();
  if (error) return respond(error.code === '23505' ? 409 : 503, {
    error: error.code === '23505' ? 'Duplicate company number.' : 'CRM create failed.',
  });
  return respond(201, { organisation: data });
}
