import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const ALLOWED_COMPANY_STATUSES = ['active', 'inactive', 'pending_approval', 'rejected', 'suspended', 'all'] as const;
type CompanyStatusFilter = (typeof ALLOWED_COMPANY_STATUSES)[number];

type GovernanceAuditRow = {
  id: string;
  target_company_id: string;
  action_type: string;
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
};

const resolveOwnerProfile = async (authUserId: string) => {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
};

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return null;
  const profile = await resolveOwnerProfile(authData.user.id);
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

/**
 * GET /api/super-admin/companies?status=active|inactive|pending_approval|rejected|suspended|all
 * Returns companies filtered by status (owner only).
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) {
    return respond(403, { error: 'Forbidden: owner role required.' });
  }

  const { searchParams } = new URL(request.url);
  const requestedStatus = searchParams.get('status');
  const status: CompanyStatusFilter = requestedStatus
    ? (requestedStatus as CompanyStatusFilter)
    : 'pending_approval';

  if (!ALLOWED_COMPANY_STATUSES.includes(status)) {
    return respond(400, {
      error: `Invalid status filter. Allowed values: ${ALLOWED_COMPANY_STATUSES.join(', ')}.`,
    });
  }

  let companyQuery = supabaseAdmin
    .from('companies')
    .select('id, name, company_number, email, status, company_type, created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  if (status !== 'all') {
    companyQuery = companyQuery.eq('status', status);
  }

  const { data, error } = await companyQuery;

  if (error) {
    return respond(500, { error: error.message });
  }

  const companies = data ?? [];

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from('owner_audit_log')
    .select('id, target_company_id, action_type, old_status, new_status, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(400);

  const governanceHistoryAvailable = !auditError;
  const governanceHistoryError = auditError?.message ?? null;

  const governanceHistoryByCompany = new Map<string, GovernanceAuditRow[]>();
  if (governanceHistoryAvailable) {
    for (const row of (auditRows ?? []) as GovernanceAuditRow[]) {
      const existing = governanceHistoryByCompany.get(row.target_company_id) ?? [];
      if (existing.length < 5) {
        existing.push(row);
        governanceHistoryByCompany.set(row.target_company_id, existing);
      }
    }
  }

  return respond(200, {
    companies,
    governanceHistoryAvailable,
    governanceHistoryError,
    governanceHistoryRecent: governanceHistoryAvailable ? (auditRows ?? []) : [],
    governanceHistoryByCompany: governanceHistoryAvailable
      ? Object.fromEntries(Array.from(governanceHistoryByCompany.entries()))
      : {},
  });
}
