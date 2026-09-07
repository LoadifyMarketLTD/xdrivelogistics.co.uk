import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { applyCompanyStatusFilter, buildCompanySearchPattern, type CompanyStatusFilter } from '../_lib/searchFilters';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const SEARCH_PAGE_SIZE = 1000;
const normalizeSearch = (raw: string) => raw.trim();
const ALLOWED_COMPANY_STATUSES = ['active', 'inactive', 'pending', 'pending_approval', 'rejected', 'suspended', 'all'] as const;
const normalizeCompanyStatusFilter = (status: CompanyStatusFilter): CompanyStatusFilter =>
  (status === 'pending' || status === 'pending_approval') ? 'pending' : status;

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

const GOVERNANCE_STATUS_COLUMN_CODES = new Set(['42703', 'PGRST204']);
const GOVERNANCE_PRIMARY_SELECT = 'id, target_company_id, action_type, old_status, new_status, reason, created_at';
const GOVERNANCE_LEGACY_SELECT = 'id, target_company_id, action_type, old_value, new_value, reason, created_at';

const loadMatchingIdsForColumn = async (column: 'name' | 'company_number' | 'email', pattern: string) => {
  if (!supabaseAdmin) return { ids: [] as string[], error: 'Server auth is not configured.' };
  const ids: string[] = [];
  for (let offset = 0; ; offset += SEARCH_PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('companies')
      .select('id')
      .ilike(column, pattern)
      .order('id', { ascending: true })
      .range(offset, offset + SEARCH_PAGE_SIZE - 1);
    if (result.error) return { ids: [] as string[], error: result.error.message };
    const page = (result.data ?? []).map((row) => String(row.id ?? '')).filter(Boolean);
    ids.push(...page);
    if (page.length < SEARCH_PAGE_SIZE) break;
  }
  return { ids, error: null as string | null };
};

const findMatchingCompanyIds = async (search: string) => {
  if (!supabaseAdmin || !search) return null;
  const pattern = buildCompanySearchPattern(search);
  const results = await Promise.all([
    loadMatchingIdsForColumn('name', pattern),
    loadMatchingIdsForColumn('company_number', pattern),
    loadMatchingIdsForColumn('email', pattern),
  ]);
  const failed = results.find((result) => result.error);
  if (failed) return { error: failed.error as string };
  return { ids: Array.from(new Set(results.flatMap((result) => result.ids))) };
};

const isGovernanceStatusColumnError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error || !error.code || !GOVERNANCE_STATUS_COLUMN_CODES.has(error.code)) return false;
  const message = String(error.message ?? '').toLowerCase();
  return message.includes('old_status') || message.includes('new_status');
};

const normalizeAuditRow = (row: RawGovernanceAuditRow): GovernanceAuditRow | null => {
  const id = typeof row.id === 'string' ? row.id : null;
  const targetCompanyId = typeof row.target_company_id === 'string' ? row.target_company_id : null;
  const actionType = typeof row.action_type === 'string' ? row.action_type : null;
  const oldStatus = typeof row.old_status === 'string' ? row.old_status : (typeof row.old_value === 'string' ? row.old_value : undefined);
  const newStatus = typeof row.new_status === 'string' ? row.new_status : (typeof row.new_value === 'string' ? row.new_value : undefined);
  const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
  if (!id || !targetCompanyId || !actionType || !createdAt) return null;
  return {
    id,
    target_company_id: targetCompanyId,
    action_type: actionType,
    ...(oldStatus !== undefined ? { old_status: oldStatus } : {}),
    ...(newStatus !== undefined ? { new_status: newStatus } : {}),
    reason: typeof row.reason === 'string' ? row.reason : '',
    created_at: createdAt,
  };
};

const normalizeAuditRows = (rows: RawGovernanceAuditRow[]) => {
  const normalizedRows: GovernanceAuditRow[] = [];
  for (const row of rows) {
    if (typeof row.target_company_id !== 'string' || row.target_company_id.length === 0) continue;
    const normalized = normalizeAuditRow(row);
    if (!normalized) return { rows: [] as GovernanceAuditRow[], error: 'Governance history is temporarily unavailable.' };
    normalizedRows.push(normalized);
  }
  return { rows: normalizedRows, error: null as string | null };
};

const loadGovernanceHistory = async () => {
  if (!supabaseAdmin) return { rows: [] as GovernanceAuditRow[], error: 'Governance history is temporarily unavailable.' };
  const fullAuditResult = await supabaseAdmin
    .from('owner_audit_log')
    .select(GOVERNANCE_PRIMARY_SELECT)
    .order('created_at', { ascending: false })
    .limit(400);
  if (!fullAuditResult.error) return normalizeAuditRows((fullAuditResult.data ?? []) as RawGovernanceAuditRow[]);
  if (!isGovernanceStatusColumnError(fullAuditResult.error)) {
    console.error('[super-admin/companies] governance history query unavailable', { code: fullAuditResult.error.code, message: fullAuditResult.error.message });
    return { rows: [] as GovernanceAuditRow[], error: 'Governance history is temporarily unavailable.' };
  }
  const legacyAuditResult = await supabaseAdmin
    .from('owner_audit_log')
    .select(GOVERNANCE_LEGACY_SELECT)
    .order('created_at', { ascending: false })
    .limit(400);
  if (legacyAuditResult.error) {
    console.error('[super-admin/companies] governance history legacy query unavailable', { code: legacyAuditResult.error.code, message: legacyAuditResult.error.message });
    return { rows: [] as GovernanceAuditRow[], error: 'Governance history is temporarily unavailable.' };
  }
  return normalizeAuditRows((legacyAuditResult.data ?? []) as RawGovernanceAuditRow[]);
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const requestedStatus = searchParams.get('status');
  const rawStatus: CompanyStatusFilter = requestedStatus ? (requestedStatus as CompanyStatusFilter) : 'pending';
  if (!ALLOWED_COMPANY_STATUSES.includes(rawStatus)) {
    return respond(400, { error: `Invalid status filter. Allowed values: ${ALLOWED_COMPANY_STATUSES.join(', ')}.` });
  }
  const status = normalizeCompanyStatusFilter(rawStatus);
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limitParam = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  const offset = (pageParam - 1) * limitParam;
  const search = normalizeSearch(searchParams.get('search') ?? '');
  const searchMatches = search ? await findMatchingCompanyIds(search) : null;
  if (searchMatches && 'error' in searchMatches) return respond(500, { error: searchMatches.error });

  if (searchMatches && searchMatches.ids.length === 0) {
    return respond(200, {
      companies: [],
      pagination: { page: pageParam, limit: limitParam, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: pageParam > 1 },
      governanceHistoryAvailable: true,
      governanceHistoryError: null,
      governanceHistoryRecent: [],
      governanceHistoryByCompany: {},
    });
  }

  let companyQuery = supabaseAdmin
    .from('companies')
    .select('id, name, company_number, email, status, company_type, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  companyQuery = applyCompanyStatusFilter(companyQuery, status);
  if (searchMatches && 'ids' in searchMatches) companyQuery = companyQuery.in('id', searchMatches.ids);
  companyQuery = companyQuery.range(offset, offset + limitParam - 1);

  const { data, error, count } = await companyQuery;
  if (error) return respond(500, { error: error.message });
  if (typeof count !== 'number') return respond(500, { error: 'Company registry returned an incomplete exact-count snapshot.' });
  const companies = data ?? [];

  const governanceResult = await loadGovernanceHistory();
  const governanceHistoryAvailable = governanceResult.error === null;
  const normalizedAuditRows = governanceHistoryAvailable ? governanceResult.rows : [];
  const governanceHistoryByCompany = new Map<string, GovernanceAuditRow[]>();
  for (const row of normalizedAuditRows) {
    const existing = governanceHistoryByCompany.get(row.target_company_id) ?? [];
    if (existing.length < 5) {
      existing.push(row);
      governanceHistoryByCompany.set(row.target_company_id, existing);
    }
  }

  const totalPages = Math.ceil(count / limitParam);
  return respond(200, {
    companies,
    pagination: {
      page: pageParam,
      limit: limitParam,
      total: count,
      totalPages,
      hasNextPage: pageParam < totalPages,
      hasPrevPage: pageParam > 1,
    },
    governanceHistoryAvailable,
    governanceHistoryError: governanceResult.error,
    governanceHistoryRecent: normalizedAuditRows,
    governanceHistoryByCompany: governanceHistoryAvailable ? Object.fromEntries(Array.from(governanceHistoryByCompany.entries())) : {},
  });
}
