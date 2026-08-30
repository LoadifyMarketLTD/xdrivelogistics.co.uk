import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const verifyPlatformOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;

  const token = getBearerToken(request);
  if (!token) return null;

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'owner') return null;
  return authData.user;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: platform owner role required.' });

  const { data, error } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, status, current_step, completion_percentage, risk_status, risk_reason, company_id, payload, created_at, submitted_at, last_activity_at')
    .in('status', ['submitted', 'under_review', 'request_changes'])
    .order('last_activity_at', { ascending: false })
    .limit(250);

  if (error) return respond(500, { error: error.message });

  const rows = Array.isArray(data) ? data : [];
  return respond(200, {
    rows,
    summary: {
      total: rows.length,
      ready: 0,
      blocked: rows.length,
      under_review: rows.filter((row) => row.status === 'under_review').length,
      request_changes: rows.filter((row) => row.status === 'request_changes').length,
    },
  });
}
