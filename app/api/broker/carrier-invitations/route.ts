import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

// ── Auth helper ──────────────────────────────────────────────────────────────

async function resolveCallerMembership(
  request: NextRequest,
  companyId: string,
): Promise<{ userId: string } | null> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;

  const token = getBearerToken(request);
  if (!token) return null;

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authErr,
  } = await validatorClient.auth.getUser(token);
  if (authErr || !user) return null;

  const { data: membership } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!membership?.id) return null;
  return { userId: user.id };
}

// ── GET — list invitations for a broker company ──────────────────────────────

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service is not configured.' });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId')?.trim();
  if (!companyId) return json(400, { error: 'companyId is required.' });

  const caller = await resolveCallerMembership(request, companyId);
  if (!caller) return json(403, { error: 'Forbidden — active broker membership required.' });

  const { data, error } = await supabaseAdmin
    .from('broker_carrier_invitations')
    .select(
      'id, invited_email, carrier_company_id, status, message, created_at, updated_at, accepted_at, revoked_at, invited_by',
    )
    .eq('broker_company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return json(500, { error: error.message });

  // Resolve carrier company names for accepted invitations
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const carrierIds = Array.from(
    new Set(rows.map((r) => r.carrier_company_id as string | null).filter(Boolean) as string[]),
  );
  let carrierNames: Map<string, string> = new Map();
  if (carrierIds.length > 0) {
    const { data: carriers } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .in('id', carrierIds);
    carrierNames = new Map(
      (carriers ?? []).map((c: Record<string, unknown>) => [c.id as string, c.name as string]),
    );
  }

  const invitations = rows.map((row) => ({
    ...row,
    carrier_company_name: row.carrier_company_id
      ? (carrierNames.get(row.carrier_company_id as string) ?? null)
      : null,
  }));

  return json(200, { invitations, total: invitations.length });
}

// ── POST — create a new carrier invitation ───────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service is not configured.' });
  }

  let body: { companyId?: string; email?: string; message?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const companyId = body.companyId?.trim();
  const rawEmail = body.email?.trim();
  const message = body.message?.trim() ?? null;

  if (!companyId) return json(400, { error: 'companyId is required.' });
  if (!rawEmail) return json(400, { error: 'email is required.' });

  const email = rawEmail.toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return json(400, { error: 'Invalid email address.' });

  const caller = await resolveCallerMembership(request, companyId);
  if (!caller) return json(403, { error: 'Forbidden — active broker membership required.' });

  // Prevent duplicate pending invitation for same (broker, email)
  const { data: existing } = await supabaseAdmin
    .from('broker_carrier_invitations')
    .select('id, status')
    .eq('broker_company_id', companyId)
    .eq('invited_email', email)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return json(409, { error: 'A pending invitation for this email already exists.' });
  }

  const { data: invitation, error: insertErr } = await supabaseAdmin
    .from('broker_carrier_invitations')
    .insert({
      broker_company_id: companyId,
      invited_email: email,
      invited_by: caller.userId,
      message,
      status: 'pending',
    })
    .select('id, invited_email, status, created_at')
    .single();

  if (insertErr) return json(500, { error: insertErr.message });

  return json(201, { invitation, success: true });
}

// ── PATCH — revoke a pending invitation ──────────────────────────────────────

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service is not configured.' });
  }

  let body: { invitationId?: string; companyId?: string; action?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const { invitationId, companyId, action } = body;
  if (!invitationId) return json(400, { error: 'invitationId is required.' });
  if (!companyId) return json(400, { error: 'companyId is required.' });
  if (action !== 'revoke') return json(400, { error: 'action must be "revoke".' });

  const caller = await resolveCallerMembership(request, companyId);
  if (!caller) return json(403, { error: 'Forbidden — active broker membership required.' });

  // Fetch the invitation and verify it belongs to this broker
  const { data: inv, error: fetchErr } = await supabaseAdmin
    .from('broker_carrier_invitations')
    .select('id, status, broker_company_id')
    .eq('id', invitationId)
    .maybeSingle();

  if (fetchErr) return json(500, { error: fetchErr.message });
  if (!inv) return json(404, { error: 'Invitation not found.' });
  if (inv.broker_company_id !== companyId)
    return json(403, { error: 'Forbidden — invitation belongs to a different company.' });
  if (inv.status !== 'pending')
    return json(409, { error: `Cannot revoke an invitation with status "${inv.status}".` });

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('broker_carrier_invitations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .select('id, status, revoked_at')
    .single();

  if (updateErr) return json(500, { error: updateErr.message });

  return json(200, { invitation: updated, success: true });
}
