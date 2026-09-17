import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const ADMIN_ROLES = ['owner', 'admin', 'dispatcher'] as const;

export type CompanyAdminContext = {
  userId: string;
  companyId: string;
  membershipId: string;
  roleInCompany: string;
  token: string;
};

export const isCompanyAdminContext = (
  value: CompanyAdminContext | NextResponse,
): value is CompanyAdminContext => !(value instanceof NextResponse);

export async function requireCompanyAdmin(
  request: NextRequest,
  requestedCompanyId: string,
): Promise<CompanyAdminContext | NextResponse> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: missing bearer token.' }, { status: 401 });
  }

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized: invalid or expired session.' }, { status: 401 });
  }

  const companyId = requestedCompanyId.trim();
  if (!companyId) {
    return NextResponse.json({ error: 'Company id is required.' }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id, company_id, role_in_company, companies!inner(status)')
    .eq('user_id', authData.user.id)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .eq('companies.status', 'active')
    .in('role_in_company', [...ADMIN_ROLES])
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: 'Unable to verify company administration access.' }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden: active company administrator required.' }, { status: 403 });
  }

  return {
    userId: authData.user.id,
    companyId: String(membership.company_id),
    membershipId: String(membership.id),
    roleInCompany: String(membership.role_in_company),
    token,
  };
}
