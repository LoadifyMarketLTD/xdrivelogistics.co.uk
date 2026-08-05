import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

/**
 * Strip PostgREST-reserved characters from a search term to prevent filter
 * injection via the `.or()` string.  Commas, parentheses, dots, and percent
 * signs are removed; the remaining value is safe to embed inside an ilike
 * pattern string.
 */
const sanitizeSearch = (raw: string) => raw.replace(/[(),%]/g, '').trim();
const ALLOWED_COMPANY_STATUSES = ['active', 'inactive', 'pending', 'pending_approval', 'rejected', 'suspended', 'all'] as const;
type CompanyStatusFilter = (typeof ALLOWED_COMPANY_STATUSES)[number];

type GovernanceAuditRow = {
  id: string;
  target_company_id: string;
  action_type: string;
  old_status?: string;
  new_status?: string;
  reason?: string;
  created_at: string;
};

type RawGovernanceAuditRow = {
  id?: unknown;
  target_company_id?: unknown;
  action_type?: unknown;
  old_status?: unknown;
  old_value?: unknown;
  new_status?: unknown;
  new_value?: unknown;
  reason?: unknown;
  created_at?: unknown;
};

const isPendingStatus = (value: string) => value === 'pending' || value === 'pending_approval';
const normalizeCompanyStatusFilter = (status: CompanyStatusFilter): CompanyStatusFilter =>
  isPendingStatus(status) ? 'pending' : status;

const normalizeAuditRow = (row: RawGovernanceAuditRow): GovernanceAuditRow | null => {
  const id = typeof row.id === 'string' ? row.id : null;
  const targetCompanyId = typeof row.target_company_id === 'string' ? row.target_company_id : null;
  const actionType = typeof row.action_type === 'string' ? row.action_type : null;
  const oldStatus = typeof row.old_status === 'string'
    ? row.old_status
    : (typeof row.old_value === 'string' ? row.old_value : null);
  const newStatus = typeof row.new_status === 'string'
    ? row.new_status
    : (typeof row.new_value === 'string' ? row.new_value : null);
  const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
  if (!id || !targetCompanyId || !actionType || !oldStatus || !newStatus || !createdAt) {
    return null;
  }

  return {
    id,
    target_company_id: targetCompanyId,
    action_type: actionType,
    old_status: oldStatus,
    new_status: newStatus,
    reason: typeof row.reason === 'string' ? row.reason : '',
    created_at: createdAt,
  };
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
 * GET /api/super-admin/companies
 * Query params:
 *   status  — active|inactive|pending|pending_approval|rejected|suspended|all (default: pending)
 *   search  — case-insensitive search on name, company_number, email (optional)
 *   page    — 1-based page number (default: 1)
 *   limit   — results per page, 1–100 (default: 50)
 *
 * Returns companies filtered by status with server-side pagination (owner only).
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
  const rawStatus: CompanyStatusFilter = requestedStatus
    ? (requestedStatus as CompanyStatusFilter)
    : 'pending';

  if (!ALLOWED_COMPANY_STATUSES.includes(rawStatus)) {
    return respond(400, {
      error: `Invalid status filter. Allowed values: ${ALLOWED_COMPANY_STATUSES.join(', ')}.`,
    });
  }
  const status = normalizeCompanyStatusFilter(rawStatus);

  // Pagination
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limitParam = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  const offset = (pageParam - 1) * limitParam;

  // Search
  const search = sanitizeSearch(searchParams.get('search')?.trim() ?? '');

  let companyQuery = supabaseAdmin
    .from('companies')
    .select('id, name, company_number, email, status, company_type, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitParam - 1);

  if (status !== 'all' && !isPendingStatus(status)) {
    companyQuery = companyQuery.eq('status', status);
  }

  // Apply search filter using ilike on name; also search company_number and email
  if (search) {
    companyQuery = companyQuery.or(
      `name.ilike.%${search}%,company_number.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }

  let { data, error, count } = await companyQuery;

  // If the query fails with an enum mismatch for 'pending_approval', retry
  // with the legacy 'pending' value that may be stored in older databases.
  if (error && status === 'pending_approval' && error.message?.includes('enum')) {
    let legacyQuery = supabaseAdmin
      .from('companies')
      .select('id, name, company_number, email, status, company_type, created_at', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + limitParam - 1);
    if (search) {
      legacyQuery = legacyQuery.or(
        `name.ilike.%${search}%,company_number.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }
    const legacyResult = await legacyQuery;
    if (!legacyResult.error) {
      data = legacyResult.data;
      count = legacyResult.count;
      error = null;
    }
  }

  if (error) {
    return respond(500, { error: error.message });
  }

  const companies = (data ?? []).filter((company) => {
    if (!isPendingStatus(status)) return true;
    const normalized = String(company.status ?? '').trim().toLowerCase();
    return isPendingStatus(normalized);
  });

  // Query governance history defensively: try full column set first, then fall
  // back to a minimal set if optional columns (old_status / new_status) do not
  // exist in the current schema (they are added by migration 087, but may be
  // absent in older or partially-migrated databases).
  let auditRows: GovernanceAuditRow[] | null = null;
  let auditError: { message: string } | null = null;

  const fullAuditResult = await supabaseAdmin
    .from('owner_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(400);

  if (!fullAuditResult.error) {
    auditRows = (fullAuditResult.data ?? []) as GovernanceAuditRow[];
  } else {
    // Full select failed (likely missing column); fall back to safe minimal set
    const minimalAuditResult = await supabaseAdmin
      .from('owner_audit_log')
      .select('id, target_company_id, action_type, created_at')
      .order('created_at', { ascending: false })
      .limit(400);

    if (!minimalAuditResult.error) {
      auditRows = (minimalAuditResult.data ?? []) as GovernanceAuditRow[];
    } else {
      auditError = { message: minimalAuditResult.error.message };
    }
  }

  const governanceHistoryAvailable = auditError === null;
  const governanceHistoryError = auditError?.message ?? null;
  const normalizedAuditRows = governanceHistoryAvailable
    ? (auditRows ?? [])
      .map((row) => normalizeAuditRow(row as RawGovernanceAuditRow))
      .filter((row): row is GovernanceAuditRow => Boolean(row))
    : [];

  const governanceHistoryByCompany = new Map<string, GovernanceAuditRow[]>();
  if (governanceHistoryAvailable) {
    for (const row of normalizedAuditRows) {
      const existing = governanceHistoryByCompany.get(row.target_company_id) ?? [];
      if (existing.length < 5) {
        existing.push(row);
        governanceHistoryByCompany.set(row.target_company_id, existing);
      }
    }
  }

  const totalCount = count ?? companies.length;
  const totalPages = Math.ceil(totalCount / limitParam);

  return respond(200, {
    companies,
    pagination: {
      page: pageParam,
      limit: limitParam,
      total: totalCount,
      totalPages,
      hasNextPage: pageParam < totalPages,
      hasPrevPage: pageParam > 1,
    },
    governanceHistoryAvailable,
    governanceHistoryError,
    governanceHistoryRecent: governanceHistoryAvailable ? normalizedAuditRows : [],
    governanceHistoryByCompany: governanceHistoryAvailable
      ? Object.fromEntries(Array.from(governanceHistoryByCompany.entries()))
      : {},
  });
}
