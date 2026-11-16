import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { hasSuperAdminBearerAuthorization, verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

export const dynamic = 'force-dynamic';
const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
const kinds = new Set(['generic_business', 'named_person', 'unknown']);
const bases = new Set(['legitimate_interests', 'consent', 'other', 'undetermined']);
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const optional = (v: unknown, max: number) => v == null || v === '' || (typeof v === 'string' && v.trim().length <= max);
const https = (v: unknown) => {
  if (typeof v !== 'string' || v.length > 2048) return false;
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
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
  const organisationId = request.nextUrl.searchParams.get('organisation_id');
  if (!uuid(organisationId)) return respond(400, { error: 'Valid organisation_id required.' });
  const { data, error } = await supabaseAdmin!.from('crm_prospect_contacts')
    .select('id,organisation_id,person_name,job_title,business_email,business_phone,contact_kind,lawful_basis,source_url,collected_at')
    .eq('organisation_id', organisationId).order('collected_at', { ascending: false }).limit(100);
  if (error) return respond(503, { error: 'CRM contacts unavailable.' });
  return respond(200, { contacts: data ?? [] });
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
  if (!uuid(body.organisation_id) || !kinds.has(String(body.contact_kind)) ||
      !bases.has(String(body.lawful_basis)) || !https(body.source_url) ||
      !optional(body.person_name, 200) || !optional(body.job_title, 200) ||
      !optional(body.business_email, 254) || !optional(body.business_phone, 40) ||
      !optional(body.lawful_basis_evidence, 2000)) return respond(400, { error: 'Invalid contact or provenance fields.' });
  const email = typeof body.business_email === 'string' ? body.business_email.trim().toLowerCase() : '';
  const phone = typeof body.business_phone === 'string' ? body.business_phone.replace(/[\s().-]/g, '') : '';
  if ((!email && !phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      (phone && !/^\+[1-9]\d{6,14}$/.test(phone))) return respond(400, { error: 'Valid business email or international phone required.' });
  if (body.contact_kind === 'named_person' && body.lawful_basis === 'undetermined')
    return respond(400, { error: 'Named contacts require a documented lawful basis.' });
  if (body.lawful_basis !== 'undetermined' &&
      (typeof body.lawful_basis_evidence !== 'string' || body.lawful_basis_evidence.trim().length < 10))
    return respond(400, { error: 'Lawful basis evidence required.' });
  // Fail closed: never import an already suppressed contact.
  const identifiers = [{ channel: 'email', value: email }, { channel: 'phone', value: phone }].filter(v => v.value);
  for (const identifier of identifiers) {
    const { data, error } = await supabaseAdmin!.from('crm_prospect_suppressions')
      .select('id').in('channel', [identifier.channel, 'all']).eq('normalized_contact_value', identifier.value).limit(1);
    if (error) return respond(503, { error: 'Suppression check unavailable.' });
    if (data?.length) return respond(409, { error: 'Contact is suppressed; cannot import.' });
  }
  const { data, error } = await supabaseAdmin!.from('crm_prospect_contacts').insert({
    organisation_id: body.organisation_id,
    person_name: typeof body.person_name === 'string' ? body.person_name.trim() || null : null,
    job_title: typeof body.job_title === 'string' ? body.job_title.trim() || null : null,
    business_email: email || null, business_phone: phone || null,
    contact_kind: body.contact_kind, lawful_basis: body.lawful_basis,
    lawful_basis_evidence: typeof body.lawful_basis_evidence === 'string' ? body.lawful_basis_evidence.trim() || null : null,
    source_url: (body.source_url as string).trim(),
  }).select('id,organisation_id,contact_kind,collected_at').single();
  if (error) return respond(error.code === '23505' || error.code === '23514' ? 409 : 503, { error: error.code === '23514' ? 'Contact is suppressed.' : error.code === '23505' ? 'Duplicate contact.' : 'Contact save failed.' });
  return respond(201, { contact: data });
}
