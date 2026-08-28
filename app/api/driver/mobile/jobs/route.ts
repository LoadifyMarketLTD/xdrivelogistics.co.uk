import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../_lib/platformFlags';
import { driverJobStatusesForScope } from '../../../../../lib/jobs/jobLifecyclePresentation';
import { loadDriverAgreedRates } from '../../_lib/commercialRate';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond, toMoney } from '../_lib';

function validIsoDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'active';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100) || 100, 1), 250);
  const statusList = driverJobStatusesForScope(scope);
  const completedHistory = scope === 'completed';
  const requestedHistoryDays = Number(searchParams.get('historyDays') ?? 365);
  const historyDays = completedHistory
    ? Math.min(365, Math.max(1, Number.isFinite(requestedHistoryDays) ? Math.round(requestedHistoryDays) : 365))
    : null;
  const cursor = completedHistory ? validIsoDate(searchParams.get('cursor')) : null;

  let query = supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('assigned_driver_id', driver.driverId)
    .order(completedHistory ? 'updated_at' : 'pickup_datetime', { ascending: !completedHistory })
    .limit(limit);

  // CX-class mobile history must remain complete enough for on-the-go POD and
  // invoice retrieval. Completed jobs default to a one-year server window and
  // use an opaque timestamp cursor so high-volume drivers are not truncated to
  // the first page. Active/all scopes keep their existing semantics.
  if (completedHistory && historyDays !== null) {
    const since = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('updated_at', since);
    if (cursor) query = query.lt('updated_at', cursor);
  }

  // `all` is intentionally assignment-gated rather than Marketplace-gated. It
  // exists for authorised execution history and does not change job lifecycle.
  // For scoped reads, current_status is authoritative when present; raw status
  // is only the fallback for legacy rows where current_status is NULL.
  if (statusList) {
    const statuses = statusList.join(',');
    query = query.or(`current_status.in.(${statuses}),and(current_status.is.null,status.in.(${statuses}))`);
  }

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  const rows = (data ?? []) as unknown as MobileJobRow[];
  const commercial = await loadDriverAgreedRates(supabaseAdmin, rows);
  const nextCursor = completedHistory && rows.length === limit
    ? rows[rows.length - 1]?.updated_at ?? null
    : null;

  return respond(200, {
    scope,
    ...(completedHistory ? { historyDays, nextCursor } : {}),
    jobs: rows.map((row) => {
      const agreedRate = commercial.rates.get(row.id) ?? null;
      return {
        ...mapJob(row),
        price: toMoney(agreedRate),
        agreedRateAmount: agreedRate,
        // Android keeps this legacy field name for assigned jobs. Its value is
        // now the accepted/agreed carrier rate only — never customer budget.
        budgetAmount: agreedRate,
      };
    }),
    commercialRatePartial: commercial.partial,
  });
}
