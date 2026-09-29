import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const FLEET_OPERATOR_ROLES = ['owner', 'admin', 'fleet_manager', 'dispatcher'] as const;

export type CompanyFleetOperatorContext = {
  userId: string;
  companyId: string;
  membershipId: string;
  roleInCompany: (typeof FLEET_OPERATOR_ROLES)[number];
  token: string;
};

export const isCompanyFleetOperatorContext = (
  value: CompanyFleetOperatorContext | NextResponse,
): value is CompanyFleetOperatorContext => !(value instanceof NextResponse);

export async function requireCompanyFleetOperator(
  request: NextRequest,
  requestedCompanyId: string,
): Promise<CompanyFleetOperatorContext | NextResponse> {
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
    .in('role_in_company', [...FLEET_OPERATOR_ROLES])
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: 'Unable to verify Fleet operation access.' }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden: active Fleet operator role required.' }, { status: 403 });
  }

  return {
    userId: authData.user.id,
    companyId: String(membership.company_id),
    membershipId: String(membership.id),
    roleInCompany: String(membership.role_in_company) as CompanyFleetOperatorContext['roleInCompany'],
    token,
  };
}
