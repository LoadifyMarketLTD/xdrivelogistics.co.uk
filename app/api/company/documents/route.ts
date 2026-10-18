import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Company document service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized — missing bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { error: 'Unauthorized — invalid or expired token.' });
  }

  const companyId = request.nextUrl.searchParams.get('companyId')?.trim();
  if (!companyId) return respond(400, { error: 'Company ID is required.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('user_id', authData.user.id)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (membershipError) return respond(500, { error: membershipError.message });
  if (!membership) {
    return respond(403, { error: 'Forbidden — this company is outside your active workspace.' });
  }

  const { data, error } = await supabaseAdmin
    .from('company_documents')
    .select('id, company_id, doc_type, file_path, status, expiry_date, review_notes, created_at, updated_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) return respond(500, { error: error.message });
  return respond(200, { documents: data ?? [] });
}
