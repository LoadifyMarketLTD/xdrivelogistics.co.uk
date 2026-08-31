import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import {
  isMissingDurabilityColumnError,
  normalizeBaseRow,
  normalizeDurabilityRow,
  type NotificationEventBaseRow,
  type NotificationEventDurabilityRow,
  type NotificationEventRow,
} from '../_lib/notificationEvents';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const titleFor = (eventType: string) => {
  const labels: Record<string, string> = {
    job_assigned: 'Job assigned',
    bid_accepted: 'Bid accepted',
    pod_uploaded: 'POD uploaded',
    invoice_created: 'Invoice created',
    invoice_sent: 'Invoice sent',
    onboarding_invite: 'Onboarding invite',
  };
  return labels[eventType] ?? eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const messageFor = (row: NotificationEventRow) => {
  const payload = row.payload ?? {};
  const pickup = typeof payload.pickup_location === 'string' ? payload.pickup_location : null;
  const delivery = typeof payload.delivery_location === 'string' ? payload.delivery_location : null;
  if (row.event_type === 'job_assigned') return `${pickup ?? 'TBC'} → ${delivery ?? 'TBC'}`;
  if (row.event_type === 'bid_accepted') {
    const amount = [payload.bid_price_gbp, payload.amount, payload.bid_amount].find((candidate) => typeof candidate === 'number');
    return typeof amount === 'number' ? `Accepted amount: £${amount.toFixed(2)}` : 'A carrier bid has been accepted.';
  }
  if (row.event_type === 'pod_uploaded') return `${pickup ?? 'Pickup'} → ${delivery ?? 'Delivery'} marked delivered.`;
  return `Entity ${row.entity_id}`;
};

const categoryFor = (eventType: string) => {
  const normalized = eventType.toLowerCase();
  if (normalized.includes('onboarding') || normalized.includes('invite')) return 'Onboarding';
  if (normalized.includes('invoice') || normalized.includes('payment') || normalized.includes('finance')) return 'Finance';
  if (normalized.includes('bid') || normalized.includes('quote') || normalized.includes('marketplace')) return 'Marketplace';
  if (normalized.includes('compliance') || normalized.includes('document') || normalized.includes('insurance') || normalized.includes('licence')) return 'Compliance';
  if (normalized.includes('driver') || normalized.includes('fleet') || normalized.includes('vehicle')) return 'Fleet';
  if (normalized.includes('job') || normalized.includes('pod') || normalized.includes('delivery')) return 'Jobs';
  if (normalized.includes('security') || normalized.includes('fraud')) return 'Security';
  return 'Platform';
};

const severityFor = (status: string, eventType: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'failed') return 'Critical';
  if (normalized === 'pending') return 'Warning';
  if (normalized === 'sent') return 'Success';
  if (eventType.toLowerCase().includes('fraud') || eventType.toLowerCase().includes('security')) return 'Warning';
  return 'Info';
};

const inspectorHref = (entityType: string, entityId: string) =>
  `/super-admin/inspect/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;

const DIRECT_INSPECTOR_TYPES = new Set(['company', 'user', 'driver', 'vehicle', 'job', 'invoice', 'ticket', 'dispute', 'case']);

type OnboardingTarget = { entityType: 'company' | 'user'; entityId: string };

const viewHrefFor = (
  row: NotificationEventRow,
  bidJobById: Map<string, string>,
  onboardingTargetById: Map<string, OnboardingTarget>,
) => {
  const entityType = String(row.entity_type ?? '').toLowerCase();
  if (!entityType || !row.entity_id) return null;

  if (entityType === 'job' && row.event_type.toLowerCase().includes('pod')) {
    return inspectorHref('pod', row.entity_id);
  }
  if (DIRECT_INSPECTOR_TYPES.has(entityType)) return inspectorHref(entityType, row.entity_id);

  if (entityType === 'bid') {
    const jobId = bidJobById.get(row.entity_id);
    return jobId ? inspectorHref('job', jobId) : null;
  }

  if (entityType === 'onboarding_application') {
    const target = onboardingTargetById.get(row.entity_id);
    return target ? inspectorHref(target.entityType, target.entityId) : null;
  }

  return null;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 50) || 50));
  const statusFilter = (searchParams.get('status') ?? 'all').trim().toLowerCase();
  const categoryFilter = (searchParams.get('category') ?? 'all').trim().toLowerCase();
  const severityFilter = (searchParams.get('severity') ?? 'all').trim().toLowerCase();
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();

  const primaryResult = await supabaseAdmin
    .from('notification_events')
    .select('id, event_type, entity_type, entity_id, recipient_user_id, payload, status, created_at, processed_at, last_error, attempt_count, next_attempt_at')
    .returns<NotificationEventDurabilityRow[]>()
    .order('created_at', { ascending: false })
    .limit(500);

  let durabilityUnavailable = false;
  let normalizedRows: NotificationEventRow[];

  if (primaryResult.error) {
    if (!isMissingDurabilityColumnError(primaryResult.error)) {
      return respond(500, { error: 'Failed to load notification events.', detail: primaryResult.error.message });
    }
    const fallbackResult = await supabaseAdmin
      .from('notification_events')
      .select('id, event_type, entity_type, entity_id, recipient_user_id, payload, status, created_at, processed_at')
      .returns<NotificationEventBaseRow[]>()
      .order('created_at', { ascending: false })
      .limit(500);
    if (fallbackResult.error) return respond(500, { error: 'Failed to load notification events.', detail: fallbackResult.error.message });
    normalizedRows = (fallbackResult.data ?? []).map(normalizeBaseRow);
    durabilityUnavailable = true;
  } else {
    normalizedRows = (primaryResult.data ?? []).map(normalizeDurabilityRow);
  }

  const bidIds = Array.from(new Set(normalizedRows.filter((row) => row.entity_type === 'bid').map((row) => row.entity_id).filter(Boolean)));
  const onboardingApplicationIds = Array.from(new Set(normalizedRows.filter((row) => row.entity_type === 'onboarding_application').map((row) => row.entity_id).filter(Boolean)));

  const [bidResolution, onboardingResolution] = await Promise.all([
    bidIds.length
      ? supabaseAdmin.from('job_bids').select('id, job_id').in('id', bidIds)
      : Promise.resolve({ data: [], error: null }),
    onboardingApplicationIds.length
      ? supabaseAdmin.from('onboarding_applications').select('id, company_id, user_id').in('id', onboardingApplicationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (bidResolution.error) return respond(500, { error: 'Failed to resolve notification bid entities.', detail: bidResolution.error.message });
  if (onboardingResolution.error) return respond(500, { error: 'Failed to resolve onboarding notification entities.', detail: onboardingResolution.error.message });

  const bidJobById = new Map((bidResolution.data ?? []).flatMap((row) => row.job_id ? [[String(row.id), String(row.job_id)] as const] : []));
  const onboardingTargetById = new Map<string, OnboardingTarget>();
  for (const row of onboardingResolution.data ?? []) {
    if (row.company_id) onboardingTargetById.set(String(row.id), { entityType: 'company', entityId: String(row.company_id) });
    else if (row.user_id) onboardingTargetById.set(String(row.id), { entityType: 'user', entityId: String(row.user_id) });
  }

  const allRows = normalizedRows.map((row) => {
    const category = categoryFor(row.event_type);
    const severity = severityFor(row.status, row.event_type);
    const title = titleFor(row.event_type);
    const message = messageFor(row);
    return {
      id: row.id,
      user_id: row.recipient_user_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      type: row.event_type,
      title,
      message,
      status: row.status,
      category,
      severity,
      processed: row.processed_at !== null,
      created_at: row.created_at,
      last_error: row.last_error,
      attempt_count: row.attempt_count,
      next_attempt_at: row.next_attempt_at,
      view_href: viewHrefFor(row, bidJobById, onboardingTargetById),
    };
  });

  const filtered = allRows.filter((row) => {
    if (statusFilter !== 'all' && row.status.toLowerCase() !== statusFilter) return false;
    if (categoryFilter !== 'all' && row.category.toLowerCase() !== categoryFilter) return false;
    if (severityFilter !== 'all' && row.severity.toLowerCase() !== severityFilter) return false;
    if (query) {
      const haystack = `${row.title} ${row.message} ${row.type} ${row.category} ${row.entity_type ?? ''} ${row.entity_id}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const start = (page - 1) * limit;
  const rows = filtered.slice(start, start + limit);

  return respond(200, {
    rows,
    summary: {
      total: filtered.length,
      pending: filtered.filter((row) => row.status === 'pending').length,
      sent: filtered.filter((row) => row.status === 'sent').length,
      failed: filtered.filter((row) => row.status === 'failed').length,
      skipped: filtered.filter((row) => row.status === 'skipped').length,
    },
    pagination: {
      page,
      limit,
      total: filtered.length,
      hasNextPage: start + limit < filtered.length,
    },
    filters: {
      categories: Array.from(new Set(allRows.map((row) => row.category))).sort(),
      severities: ['Critical', 'Warning', 'Info', 'Success'],
      statuses: Array.from(new Set(allRows.map((row) => row.status))).sort(),
    },
    ...(durabilityUnavailable
      ? { diagnosticNote: 'Notification durability details are unavailable in the connected schema.' }
      : {}),
  });
}
