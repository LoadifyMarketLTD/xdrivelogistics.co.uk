import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type MarketplaceRow = {
  id: string;
  status: string;
  company_id: string;
  awarded_carrier_company_id: string | null;
  exchange_visibility: string;
  exchange_posted_at: string | null;
  created_at: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
};

type CompanyRow = { id: string; name: string };
type BidRow = { job_id: string };
type MarketplaceAuditRow = {
  id: string;
  actor_user_id: string;
  target_company_id: string;
  action_type: string;
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
};

type RawMarketplaceAuditRow = {
  id?: unknown;
  actor_user_id?: unknown;
  target_company_id?: unknown;
  action_type?: unknown;
  old_status?: unknown;
  old_value?: unknown;
  new_status?: unknown;
  new_value?: unknown;
  reason?: unknown;
  created_at?: unknown;
};

const MARKETPLACE_AUDIT_ACTION_TYPES = [
  'marketplace_published',
  'marketplace_hidden',
  'marketplace_job_disputed',
  'marketplace_job_cancelled',
] as const;

const queryMarketplaceRows = async (limit: number) =>
  supabaseAdmin!
    .from('jobs')
    .select('id, status, company_id, awarded_carrier_company_id, exchange_visibility, exchange_posted_at, created_at, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime')
    .order('created_at', { ascending: false })
    .limit(limit);

const enrichMarketplaceRows = async (marketplaceRows: MarketplaceRow[]) => {
  if (marketplaceRows.length === 0) return [];

  const companyIds = Array.from(
    new Set(
      marketplaceRows
        .flatMap((job) => [job.company_id, job.awarded_carrier_company_id])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [companiesResult, bidCountsResult] = await Promise.all([
    supabaseAdmin!.from('companies').select('id, name').in('id', companyIds),
    supabaseAdmin!.from('job_bids').select('job_id').in('job_id', marketplaceRows.map((job) => job.id)),
  ]);

  if (companiesResult.error) return { error: companiesResult.error.message };
  if (bidCountsResult.error) return { error: bidCountsResult.error.message };

  const companyNameById = new Map<string, string>((companiesResult.data as CompanyRow[]).map((row) => [row.id, row.name]));
  const bidCountByJobId = new Map<string, number>();
  for (const row of (bidCountsResult.data as BidRow[])) {
    bidCountByJobId.set(row.job_id, (bidCountByJobId.get(row.job_id) ?? 0) + 1);
  }

  return marketplaceRows.map((job) => ({
    ...job,
    posting_company_name: companyNameById.get(job.company_id) ?? 'Unknown company',
    awarded_company_name: job.awarded_carrier_company_id
      ? (companyNameById.get(job.awarded_carrier_company_id) ?? 'Unknown company')
      : null,
    bids_count: bidCountByJobId.get(job.id) ?? 0,
  }));
};

const getMarketplaceAuditHistory = async (limit: number) => {
  const { data, error } = await supabaseAdmin!
    .from('owner_audit_log')
    .select('*')
    .in('action_type', [...MARKETPLACE_AUDIT_ACTION_TYPES])
    .order('created_at', { ascending: false })
    .limit(limit);

  const rows = (data ?? [])
    .map((row) => {
      const raw = row as RawMarketplaceAuditRow;
      const id = typeof raw.id === 'string' ? raw.id : null;
      const actorUserId = typeof raw.actor_user_id === 'string' ? raw.actor_user_id : null;
      const targetCompanyId = typeof raw.target_company_id === 'string' ? raw.target_company_id : null;
      const actionType = typeof raw.action_type === 'string' ? raw.action_type : null;
      const oldStatus = typeof raw.old_status === 'string'
        ? raw.old_status
        : (typeof raw.old_value === 'string' ? raw.old_value : null);
      const newStatus = typeof raw.new_status === 'string'
        ? raw.new_status
        : (typeof raw.new_value === 'string' ? raw.new_value : null);
      const createdAt = typeof raw.created_at === 'string' ? raw.created_at : null;
      if (!id || !actorUserId || !targetCompanyId || !actionType || !oldStatus || !newStatus || !createdAt) return null;
      return {
        id,
        actor_user_id: actorUserId,
        target_company_id: targetCompanyId,
        action_type: actionType,
        old_status: oldStatus,
        new_status: newStatus,
        reason: typeof raw.reason === 'string' ? raw.reason : '',
        created_at: createdAt,
      };
    })
    .filter((row): row is MarketplaceAuditRow => Boolean(row));

  return { data: rows, error };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);
  const auditLimit = Math.min(Number(searchParams.get('auditLimit') ?? 120) || 120, 400);

  const { data: jobs, error: jobsError } = await queryMarketplaceRows(limit);
  if (jobsError) return respond(500, { error: jobsError.message });

  const marketplaceRows = (jobs ?? []) as MarketplaceRow[];
  const enrichedRows = await enrichMarketplaceRows(marketplaceRows);
  if ('error' in enrichedRows) return respond(500, { error: enrichedRows.error });

  const { data: auditRows, error: auditError } = await getMarketplaceAuditHistory(auditLimit);
  const governanceHistoryAvailable = !auditError;
  const governanceHistoryError = auditError?.message ?? null;

  const summary = {
    totalJobs: enrichedRows.length,
    exchangeVisible: enrichedRows.filter((row) => row.exchange_visibility === 'exchange').length,
    posted: enrichedRows.filter((row) => row.status === 'posted').length,
    allocated: enrichedRows.filter((row) => row.status === 'allocated').length,
    inTransit: enrichedRows.filter((row) => row.status === 'in_transit').length,
    disputed: enrichedRows.filter((row) => row.status === 'disputed').length,
    cancelled: enrichedRows.filter((row) => row.status === 'cancelled').length,
    delivered: enrichedRows.filter((row) => row.status === 'delivered').length,
  };

  return respond(200, {
    jobs: enrichedRows,
    summary,
    governanceHistoryAvailable,
    governanceHistoryError,
    governanceHistoryRecent: governanceHistoryAvailable ? auditRows : [],
    fetchedAt: new Date().toISOString(),
    pollingSuggestedMs: 15000,
  });
}
