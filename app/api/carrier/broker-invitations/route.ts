import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

/**
 * GET /api/carrier/broker-invitations
 *
 * Returns broker invitations addressed to the authenticated carrier user.
 * Matches by carrier_company_id (the caller's company) or carrier_email
 * (the caller's auth email address).
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized — missing bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized — invalid or expired token.' });
  }

  const admin = supabaseAdmin;
  const callerEmail = authData.user.email?.toLowerCase() ?? '';

  // Resolve the caller's company (best effort; invitation may be email-only)
  const { data: membership } = await admin
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  const callerCompanyId = (membership?.company_id as string | null) ?? null;

  // Build OR filter: company match OR email match
  const orParts: string[] = [];
  if (callerCompanyId) orParts.push(`carrier_company_id.eq.${callerCompanyId}`);
  if (callerEmail) orParts.push(`invited_email.ilike.${callerEmail}`);

  if (orParts.length === 0) {
    return json(200, { invitations: [] });
  }

  const { data: rows, error } = await admin
    .from('broker_carrier_invitations')
    .select('id, broker_company_id, invited_email, carrier_company_id, status, message, created_at, updated_at')
    .or(orParts.join(','))
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return json(500, { error: error.message });

  // Enrich with broker company names
  const brokerCompanyIds = [...new Set((rows ?? []).map((r) => r.broker_company_id))];
  const nameMap = new Map<string, string>();
  if (brokerCompanyIds.length > 0) {
    const { data: companies } = await admin
      .from('companies')
      .select('id, name')
      .in('id', brokerCompanyIds);
    for (const c of companies ?? []) nameMap.set(c.id, c.name);
  }

  return json(200, {
    invitations: (rows ?? []).map((row) => ({
      ...row,
      brokerCompanyName: nameMap.get(row.broker_company_id) ?? null,
    })),
  });
}
