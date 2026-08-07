import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import {
  isMissingDurabilityColumnError,
  normalizeBaseRow,
  normalizeDurabilityRow,
  type NotificationEventBaseRow,
  type NotificationEventDurabilityRow,
  type NotificationEventRow,
} from '../_lib/notificationEvents';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

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
    const amount = [payload.bid_price_gbp, payload.amount, payload.bid_amount].find((value) => typeof value === 'number');
    return typeof amount === 'number' ? `Accepted amount: £${amount.toFixed(2)}` : 'A carrier bid has been accepted.';
  }
  if (row.event_type === 'pod_uploaded') return `${pickup ?? 'Pickup'} → ${delivery ?? 'Delivery'} marked delivered.`;
  return `Entity ${row.entity_id}`;
};

const categoryFor = (eventType: string) => {
  const value = eventType.toLowerCase();
  if (value.includes('onboarding') || value.includes('invite')) return 'Onboarding';
  if (value.includes('invoice') || value.includes('payment') || value.includes('finance')) return 'Finance';
  if (value.includes('bid') || value.includes('quote') || value.includes('marketplace')) return 'Marketplace';
  if (value.includes('compliance') || value.includes('document') || value.includes('insurance') || value.includes('licence')) return 'Compliance';
  if (value.includes('driver') || value.includes('fleet') || value.includes('vehicle')) return 'Fleet';
  if (value.includes('job') || value.includes('pod') || value.includes('delivery')) return 'Jobs';
  if (value.includes('security') || value.includes('fraud')) return 'Security';
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

const viewHrefFor = (eventType: string, entityId: string) => {
  const value = eventType.toLowerCase();
  if (value.includes('job') || value.includes('pod') || value.includes('delivery') || value.includes('bid') || value.includes('quote')) {
    return `/super-admin/operations/jobs?focus=${encodeURIComponent(entityId)}`;
  }
  if (value.includes('invoice') || value.includes('payment')) return '/super-admin/finance/invoices';
  if (value.includes('onboarding') || value.includes('company')) return '/super-admin/companies/approvals';
  if (value.includes('compliance') || value.includes('document') || value.includes('insurance') || value.includes('licence')) return '/super-admin/companies/compliance';
  return null;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 50) || 50));
  const statusFilter = (searchParams.get('status') ?? 'all').trim().toLowerCase();
  const categoryFilter = (searchParams.get('category') ?? 'all').trim().toLowerCase();
  const severityFilter = (searchParams.get('severity') ?? 'all').trim().toLowerCase();
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();

  const primaryResult = await supabaseAdmin
    .from('notification_events')
    .select('id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at, last_error, attempt_count, next_attempt_at')
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
      .select('id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at')
      .returns<NotificationEventBaseRow[]>()
      .order('created_at', { ascending: false })
      .limit(500);
    if (fallbackResult.error) return respond(500, { error: 'Failed to load notification events.', detail: fallbackResult.error.message });
    normalizedRows = (fallbackResult.data ?? []).map(normalizeBaseRow);
    durabilityUnavailable = true;
  } else {
    normalizedRows = (primaryResult.data ?? []).map(normalizeDurabilityRow);
  }

  const allRows = normalizedRows.map((row) => {
    const category = categoryFor(row.event_type);
    const severity = severityFor(row.status, row.event_type);
    const title = titleFor(row.event_type);
    const message = messageFor(row);
    return {
      id: row.id,
      user_id: row.recipient_user_id,
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
      view_href: viewHrefFor(row.event_type, row.entity_id),
    };
  });

  const filtered = allRows.filter((row) => {
    if (statusFilter !== 'all' && row.status.toLowerCase() !== statusFilter) return false;
    if (categoryFilter !== 'all' && row.category.toLowerCase() !== categoryFilter) return false;
    if (severityFilter !== 'all' && row.severity.toLowerCase() !== severityFilter) return false;
    if (query) {
      const haystack = `${row.title} ${row.message} ${row.type} ${row.category} ${row.entity_id}`.toLowerCase();
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
