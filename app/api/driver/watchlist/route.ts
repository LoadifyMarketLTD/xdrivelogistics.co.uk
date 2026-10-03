import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

async function resolveCompany(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { error: respond(503, { error: 'Server auth is not configured.' }) };
  const token = getBearerToken(request);
  if (!token) return { error: respond(401, { error: 'Missing bearer token.' }) };
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return { error: respond(401, { error: 'Invalid session.' }) };
  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (driverError) return { error: respond(500, { error: driverError.message }) };
  if (!driver?.company_id) return { error: respond(403, { error: 'Driver company context is unavailable.' }) };
  return { userId: auth.user.id, companyId: driver.company_id as string };
}

export async function GET(request: NextRequest) {
  const ctx = await resolveCompany(request);
  if ('error' in ctx) return ctx.error;

  const { data: rows, error } = await supabaseAdmin!
    .from('company_watchlist')
    .select('id, target_company_id, created_at')
    .eq('owner_company_id', ctx.companyId)
    .order('created_at', { ascending: false });
  if (error) return respond(500, { error: error.message });

  const companyIds = [...new Set((rows ?? []).map((row) => row.target_company_id).filter(Boolean))];
  const [{ data: companies, error: companiesError }, { data: docs, error: docsError }] = await Promise.all([
    companyIds.length
      ? supabaseAdmin!.from('companies').select('id, name, xd_id, company_type').in('id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    companyIds.length
      ? supabaseAdmin!.from('company_documents').select('company_id, status, expiry_date').in('company_id', companyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (companiesError) return respond(500, { error: companiesError.message });
  if (docsError) return respond(500, { error: docsError.message });

  const companyById = new Map((companies ?? []).map((company) => [company.id, company]));
  const docsByCompany = new Map<string, Array<{ status: string | null; expiry_date: string | null }>>();
  for (const doc of docs ?? []) {
    const list = docsByCompany.get(doc.company_id) ?? [];
    list.push({ status: doc.status, expiry_date: doc.expiry_date });
    docsByCompany.set(doc.company_id, list);
  }

  const now = Date.now();
  const thirtyDays = 30 * 86_400_000;
  const items = (rows ?? []).map((row) => {
    const company = companyById.get(row.target_company_id);
    const companyDocs = docsByCompany.get(row.target_company_id) ?? [];
    const hasUpdatesNeeded = companyDocs.some((doc) => String(doc.status ?? '').toLowerCase() !== 'approved');
    const hasExpired = companyDocs.some((doc) => doc.expiry_date && new Date(doc.expiry_date).getTime() < now);
    const hasExpiringSoon = companyDocs.some((doc) => {
      if (!doc.expiry_date) return false;
      const diff = new Date(doc.expiry_date).getTime() - now;
      return diff >= 0 && diff <= thirtyDays;
    });
    const compliance = hasUpdatesNeeded || hasExpired
      ? 'updates_needed'
      : hasExpiringSoon
        ? 'about_to_expire'
        : companyDocs.length
          ? 'fully_compliant'
          : 'no_evidence';

    return {
      id: row.id,
      companyId: row.target_company_id,
      companyName: company?.name ?? 'Member',
      memberId: company?.xd_id ?? null,
      companyType: company?.company_type ?? null,
      createdAt: row.created_at,
      compliance,
    };
  });

  return respond(200, {
    items,
    summary: {
      total: items.length,
      fullyCompliant: items.filter((item) => item.compliance === 'fully_compliant').length,
      aboutToExpire: items.filter((item) => item.compliance === 'about_to_expire').length,
      updatesNeeded: items.filter((item) => item.compliance === 'updates_needed').length,
      noEvidence: items.filter((item) => item.compliance === 'no_evidence').length,
    },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await resolveCompany(request);
  if ('error' in ctx) return ctx.error;
  const body = await request.json().catch(() => null) as { companyId?: string } | null;
  const targetCompanyId = body?.companyId?.trim();
  if (!targetCompanyId) return respond(400, { error: 'companyId is required.' });
  if (targetCompanyId === ctx.companyId) return respond(400, { error: 'A company cannot add itself to its watchlist.' });

  const { error } = await supabaseAdmin!.from('company_watchlist').upsert({
    owner_company_id: ctx.companyId,
    target_company_id: targetCompanyId,
    created_by: ctx.userId,
  }, { onConflict: 'owner_company_id,target_company_id' });
  if (error) return respond(500, { error: error.message });
  return respond(200, { success: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await resolveCompany(request);
  if ('error' in ctx) return ctx.error;
  const companyId = new URL(request.url).searchParams.get('companyId')?.trim();
  if (!companyId) return respond(400, { error: 'companyId is required.' });

  const { error } = await supabaseAdmin!
    .from('company_watchlist')
    .delete()
    .eq('owner_company_id', ctx.companyId)
    .eq('target_company_id', companyId);
  if (error) return respond(500, { error: error.message });
  return respond(200, { success: true });
}
