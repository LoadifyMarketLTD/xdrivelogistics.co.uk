import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isCompanyCapabilityContext, requireCompanyCapability } from '../../admin/_lib/requireCompanyCapability';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';

async function resolveBlockedCompany(reference: string) {
  if (!supabaseAdmin) return null;
  const ref = reference.trim();
  if (!ref) return null;

  let query = supabaseAdmin
    .from('companies')
    .select('id,name,trading_name,legal_name,xd_id,company_number,status')
    .limit(2);

  if (uuidPattern.test(ref)) query = query.eq('id', ref);
  else if (/^XD-/i.test(ref)) query = query.ilike('xd_id', ref);
  else if (/^[A-Z0-9]{6,12}$/i.test(ref)) query = query.ilike('company_number', ref);
  else query = query.ilike('name', ref);

  const { data, error } = await query;
  if (error || !data || data.length !== 1) return null;
  return data[0];
}

export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  const auth = await requireCompanyCapability(request, companyId, 'company.manage');
  if (!isCompanyCapabilityContext(auth)) return auth;

  const { data: blocks, error } = await supabaseAdmin!
    .from('company_member_blocks')
    .select('id,blocked_company_id,reason,created_at,created_by')
    .eq('blocker_company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) return json(500, { error: 'Blocked members could not be loaded.' });

  const blockedIds = (blocks ?? []).map((row) => row.blocked_company_id);
  let companies: Array<Record<string, unknown>> = [];
  if (blockedIds.length) {
    const { data, error: companiesError } = await supabaseAdmin!
      .from('companies')
      .select('id,name,trading_name,legal_name,xd_id,company_number,status')
      .in('id', blockedIds);
    if (companiesError) return json(500, { error: 'Blocked company details could not be loaded.' });
    companies = data ?? [];
  }

  const companyById = new Map(companies.map((row) => [String(row.id), row]));
  return json(200, {
    blocks: (blocks ?? []).map((row) => ({
      ...row,
      company: companyById.get(String(row.blocked_company_id)) ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { companyId?: unknown; blockedCompanyReference?: unknown; reason?: unknown } | null;
  const companyId = clean(body?.companyId, 80);
  const reference = clean(body?.blockedCompanyReference, 160);
  const reason = clean(body?.reason, 500);
  const auth = await requireCompanyCapability(request, companyId, 'company.manage');
  if (!isCompanyCapabilityContext(auth)) return auth;
  if (!reference) return json(400, { error: 'Enter a company XD ID, company number or exact company name.' });

  const blocked = await resolveBlockedCompany(reference);
  if (!blocked) return json(404, { error: 'Exactly one matching XDrive company could not be found.' });
  if (String(blocked.id) === companyId) return json(422, { error: 'A company cannot block itself.' });

  const { data, error } = await supabaseAdmin!
    .from('company_member_blocks')
    .upsert({
      blocker_company_id: companyId,
      blocked_company_id: blocked.id,
      reason: reason || null,
      created_by: auth.userId,
    }, { onConflict: 'blocker_company_id,blocked_company_id' })
    .select('id,blocked_company_id,reason,created_at')
    .single();

  if (error || !data) return json(500, { error: 'Member block could not be saved.' });
  return json(200, { block: data, company: blocked });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null) as { companyId?: unknown; blockId?: unknown } | null;
  const companyId = clean(body?.companyId, 80);
  const blockId = clean(body?.blockId, 80);
  const auth = await requireCompanyCapability(request, companyId, 'company.manage');
  if (!isCompanyCapabilityContext(auth)) return auth;
  if (!uuidPattern.test(blockId)) return json(400, { error: 'A valid block record is required.' });

  const { error } = await supabaseAdmin!
    .from('company_member_blocks')
    .delete()
    .eq('id', blockId)
    .eq('blocker_company_id', companyId);

  if (error) return json(500, { error: 'Member block could not be removed.' });
  return json(200, { ok: true });
}
