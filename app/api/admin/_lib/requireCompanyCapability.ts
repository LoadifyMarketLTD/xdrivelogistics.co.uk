import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import {
  hasWorkspaceCapability,
  type WorkspaceCapability,
  type WorkspaceRole,
} from '../../../../lib/workspaceRole';

const MEMBERSHIP_WORKSPACE_ROLE: Record<string, WorkspaceRole> = {
  owner: 'company_owner',
  admin: 'company_admin',
  fleet_manager: 'fleet_manager',
  dispatcher: 'dispatcher',
  finance: 'finance',
  compliance: 'compliance',
  viewer: 'viewer',
  member: 'viewer',
};

export type CompanyCapabilityContext = {
  userId: string;
  companyId: string;
  membershipId: string;
  roleInCompany: string;
  workspaceRole: WorkspaceRole;
  token: string;
};

export const isCompanyCapabilityContext = (
  value: CompanyCapabilityContext | NextResponse,
): value is CompanyCapabilityContext => !(value instanceof NextResponse);

type CapabilityRequirement =
  | WorkspaceCapability
  | {
      anyOf: readonly WorkspaceCapability[];
    };

const satisfies = (
  role: WorkspaceRole,
  requirement: CapabilityRequirement,
) => typeof requirement === 'string'
  ? hasWorkspaceCapability(role, requirement)
  : requirement.anyOf.some((capability) => hasWorkspaceCapability(role, capability));

export async function requireCompanyCapability(
  request: NextRequest,
  requestedCompanyId: string,
  requirement: CapabilityRequirement,
): Promise<CompanyCapabilityContext | NextResponse> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: missing bearer token.' }, { status: 401 });
  }

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
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
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: 'Unable to verify company permission.' }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden: active company membership required.' }, { status: 403 });
  }

  const roleInCompany = String(membership.role_in_company ?? '').trim().toLowerCase();
  const workspaceRole = MEMBERSHIP_WORKSPACE_ROLE[roleInCompany];
  if (!workspaceRole || !satisfies(workspaceRole, requirement)) {
    return NextResponse.json({ error: 'Forbidden: required workspace capability is not available for this role.' }, { status: 403 });
  }

  return {
    userId: authData.user.id,
    companyId: String(membership.company_id),
    membershipId: String(membership.id),
    roleInCompany,
    workspaceRole,
    token,
  };
}
