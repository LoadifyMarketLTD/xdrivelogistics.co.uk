import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

type CompanyRow = { id: string; name: string };

const companyNameMap = async (ids: string[]): Promise<Map<string, string>> => {
  if (!supabaseAdmin || ids.length === 0) return new Map();
  const { data } = await supabaseAdmin.from('companies').select('id, name').in('id', ids);
  return new Map((data as CompanyRow[] ?? []).map((c) => [c.id, c.name]));
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

  // ── Disputes ─────────────────────────────────────────────────────────────────
  if (section === 'disputes') {
    const { data, error } = await supabaseAdmin
      .from('invoice_disputes')
      .select('id, invoice_id, company_id, reason, details, status, resolution_note, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return respond(500, { error: error.message });

    const rows = data ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    return respond(200, {
      section,
      rows: rows.map((r) => ({
        ...r,
        company_name: nameById.get(r.company_id as string) ?? 'Unknown',
      })),
      summary: {
        total: rows.length,
        open: rows.filter((r) => r.status === 'open').length,
        investigating: rows.filter((r) => r.status === 'investigating').length,
        resolved: rows.filter((r) => r.status === 'resolved').length,
        closed: rows.filter((r) => r.status === 'closed').length,
      },
    });
  }

  // ── Complaints (reviews) ─────────────────────────────────────────────────────
  if (section === 'complaints') {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('id, company_id, reviewer_id, rating, comment, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
      .catch(() => ({ data: null, error: { message: 'reviews table not available' } }));

    if (error) {
      // reviews table may not exist yet; return graceful empty response
      return respond(200, {
        section,
        rows: [],
        summary: { total: 0, low_rated: 0, average_rating: null },
        note: 'No complaints data available. Reviews table may not be populated yet.',
      });
    }

    const rows = data ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const ratings = rows.map((r) => Number(r.rating)).filter((n) => !isNaN(n));
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

    return respond(200, {
      section,
      rows: rows.map((r) => ({
        ...r,
        company_name: nameById.get(r.company_id as string) ?? 'Unknown',
      })),
      summary: {
        total: rows.length,
        low_rated: rows.filter((r) => Number(r.rating) <= 2).length,
        average_rating: avgRating,
      },
    });
  }

  // ── Tickets ───────────────────────────────────────────────────────────────────
  if (section === 'tickets') {
    // No support tickets table yet — return informative empty response
    return respond(200, {
      section,
      rows: [],
      summary: { total: 0, open: 0, resolved: 0 },
      note: 'Support ticket system not yet configured. Tickets will appear here once the ticketing integration is active.',
    });
  }

  return respond(400, { error: 'Invalid section. Use disputes, complaints, or tickets.' });
}
