import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const scalarMeta = (value: unknown) => !value || typeof value !== 'object' || Array.isArray(value)
  ? {}
  : Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
      .slice(0, 20));

type EventLogRow = {
  id: string;
  event_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: string | null;
  source: string;
  job_id: string | null;
};

const dateBounds = (request: NextRequest) => {
  const from = text(request.nextUrl.searchParams.get('from'));
  const to = text(request.nextUrl.searchParams.get('to'));
  return {
    from,
    to,
    fromIso: from ? new Date(`${from}T00:00:00`).toISOString() : null,
    toIso: to ? new Date(`${to}T23:59:59.999`).toISOString() : null,
  };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Event Log is temporarily unavailable.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const { fromIso, toIso } = dateBounds(request);
  const [membershipsResult, driverResult] = await Promise.all([
    supabaseAdmin
      .from('company_memberships')
      .select('company_id,companies!inner(status)')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .eq('companies.status', 'active'),
    supabaseAdmin.from('drivers').select('id').eq('user_id', authData.user.id).eq('status', 'active').maybeSingle(),
  ]);
  if (membershipsResult.error || driverResult.error) return json(500, { error: 'Event Log scope could not be verified.' });

  const companyIds = [...new Set((membershipsResult.data ?? [])
    .map((row) => text(row.company_id))
    .filter((value): value is string => Boolean(value)))];
  const driverId = text(driverResult.data?.id);

  let notificationsQuery = supabaseAdmin
    .from('notification_events')
    .select('id,event_type,entity_type,entity_id,payload,created_at')
    .eq('recipient_user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (fromIso) notificationsQuery = notificationsQuery.gte('created_at', fromIso);
  if (toIso) notificationsQuery = notificationsQuery.lte('created_at', toIso);

  let jobsQuery = supabaseAdmin.from('jobs').select('id');
  const jobScope: string[] = [];
  for (const companyId of companyIds) {
    jobScope.push(
      `company_id.eq.${companyId}`,
      `assigned_company_id.eq.${companyId}`,
      `awarded_carrier_company_id.eq.${companyId}`,
    );
  }
  if (driverId) jobScope.push(`assigned_driver_id.eq.${driverId}`);
  jobsQuery = jobScope.length
    ? jobsQuery.or(jobScope.join(','))
    : jobsQuery.eq('id', '00000000-0000-0000-0000-000000000000');

  const loadCompanyAudits = async () => {
    if (!companyIds.length) return { data: [] as Record<string, unknown>[], error: null };
    let query = supabaseAdmin!
      .from('audit_logs')
      .select('id,company_id,actor_id,action,entity_type,entity_id,details,created_at')
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })
      .limit(500);
    if (fromIso) query = query.gte('created_at', fromIso);
    if (toIso) query = query.lte('created_at', toIso);
    return query;
  };

  const loadInvoiceStatuses = async () => {
    if (!companyIds.length) return { data: [] as Record<string, unknown>[], error: null };
    let query = supabaseAdmin!
      .from('invoice_status_history')
      .select('id,invoice_id,company_id,from_status,to_status,changed_by,note,changed_at')
      .in('company_id', companyIds)
      .order('changed_at', { ascending: false })
      .limit(500);
    if (fromIso) query = query.gte('changed_at', fromIso);
    if (toIso) query = query.lte('changed_at', toIso);
    return query;
  };

  const loadInvoicePayments = async () => {
    if (!companyIds.length) return { data: [] as Record<string, unknown>[], error: null };
    let query = supabaseAdmin!
      .from('invoice_payment_history')
      .select('id,invoice_id,company_id,recorded_by,amount,currency,paid_at,settlement_method,external_reference,note,status_after,created_at')
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })
      .limit(500);
    if (fromIso) query = query.gte('created_at', fromIso);
    if (toIso) query = query.lte('created_at', toIso);
    return query;
  };

  const loadWorkspaceSwitches = async () => {
    if (!companyIds.length) return { data: [] as Record<string, unknown>[], error: null };
    let query = supabaseAdmin!
      .from('workspace_switch_audit')
      .select('id,actor_user_id,target_company_id,workspace_key,reason,created_at')
      .eq('actor_user_id', authData.user.id)
      .in('target_company_id', companyIds)
      .order('created_at', { ascending: false })
      .limit(250);
    if (fromIso) query = query.gte('created_at', fromIso);
    if (toIso) query = query.lte('created_at', toIso);
    return query;
  };

  const [
    notificationsResult,
    jobsResult,
    companyAuditResult,
    invoiceStatusResult,
    invoicePaymentResult,
    workspaceSwitchResult,
  ] = await Promise.all([
    notificationsQuery,
    jobsQuery.limit(500),
    loadCompanyAudits(),
    loadInvoiceStatuses(),
    loadInvoicePayments(),
    loadWorkspaceSwitches(),
  ]);

  const sourceError = notificationsResult.error
    ?? jobsResult.error
    ?? companyAuditResult.error
    ?? invoiceStatusResult.error
    ?? invoicePaymentResult.error
    ?? workspaceSwitchResult.error;
  if (sourceError) return json(500, { error: sourceError.message ?? 'Event Log could not be loaded.' });

  const jobIds = (jobsResult.data ?? []).map((row) => String(row.id));
  let trackingRows: Record<string, unknown>[] = [];
  if (jobIds.length) {
    let trackingQuery = supabaseAdmin
      .from('job_tracking_events')
      .select('*')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })
      .limit(1500);
    if (fromIso) trackingQuery = trackingQuery.gte('created_at', fromIso);
    if (toIso) trackingQuery = trackingQuery.lte('created_at', toIso);
    const trackingResult = await trackingQuery;
    if (trackingResult.error) return json(500, { error: trackingResult.error.message });
    trackingRows = (trackingResult.data ?? []) as Record<string, unknown>[];
  }

  const notificationEvents: EventLogRow[] = (notificationsResult.data ?? []).map((row) => ({
    id: `notification-${String(row.id)}`,
    event_type: text(row.event_type),
    entity_type: text(row.entity_type),
    entity_id: text(row.entity_id),
    payload: {
      ...(row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? row.payload as Record<string, unknown>
        : {}),
      source: 'notification',
    },
    created_at: text(row.created_at),
    source: 'notification',
    job_id: row.entity_type === 'job'
      ? text(row.entity_id)
      : text((row.payload as Record<string, unknown> | null)?.job_id),
  }));

  const trackingEvents: EventLogRow[] = trackingRows.map((row) => {
    const jobId = text(row.job_id);
    return {
      id: `tracking-${text(row.id) ?? crypto.randomUUID()}`,
      event_type: text(row.event_type) ?? 'tracking_update',
      entity_type: 'job',
      entity_id: jobId,
      payload: {
        ...scalarMeta(row.meta),
        source: 'tracking',
        job_id: jobId,
        message: text(row.message) ?? text(row.note),
        actor_user_id: text(row.user_id) ?? text(row.created_by),
      },
      created_at: text(row.event_time) ?? text(row.created_at),
      source: 'tracking',
      job_id: jobId,
    };
  });

  const companyAuditEvents: EventLogRow[] = (companyAuditResult.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: `company-audit-${String(row.id)}`,
      event_type: text(row.action) ?? 'company_audit',
      entity_type: text(row.entity_type) ?? 'company',
      entity_id: text(row.entity_id) ?? text(row.company_id),
      payload: {
        ...scalarMeta(row.details),
        source: 'company_audit',
        company_id: text(row.company_id),
        actor_user_id: text(row.actor_id),
      },
      created_at: text(row.created_at),
      source: 'company_audit',
      job_id: text(row.entity_type) === 'job' ? text(row.entity_id) : null,
    };
  });

  const invoiceStatusEvents: EventLogRow[] = (invoiceStatusResult.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: `invoice-status-${String(row.id)}`,
      event_type: 'invoice_status_changed',
      entity_type: 'invoice',
      entity_id: text(row.invoice_id),
      payload: {
        source: 'invoice_status',
        company_id: text(row.company_id),
        from_status: text(row.from_status),
        to_status: text(row.to_status),
        message: text(row.note),
        actor_user_id: text(row.changed_by),
      },
      created_at: text(row.changed_at),
      source: 'invoice_status',
      job_id: null,
    };
  });

  const invoicePaymentEvents: EventLogRow[] = (invoicePaymentResult.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: `invoice-payment-${String(row.id)}`,
      event_type: 'invoice_payment_recorded',
      entity_type: 'invoice',
      entity_id: text(row.invoice_id),
      payload: {
        source: 'invoice_payment',
        company_id: text(row.company_id),
        amount: row.amount == null ? null : Number(row.amount),
        currency: text(row.currency),
        paid_at: text(row.paid_at),
        settlement_method: text(row.settlement_method),
        external_reference: text(row.external_reference),
        status: text(row.status_after),
        message: text(row.note),
        actor_user_id: text(row.recorded_by),
      },
      created_at: text(row.created_at),
      source: 'invoice_payment',
      job_id: null,
    };
  });

  const workspaceEvents: EventLogRow[] = (workspaceSwitchResult.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: `workspace-${String(row.id)}`,
      event_type: 'workspace_switch',
      entity_type: 'company',
      entity_id: text(row.target_company_id),
      payload: {
        source: 'workspace',
        workspace: text(row.workspace_key),
        message: text(row.reason),
        actor_user_id: text(row.actor_user_id),
      },
      created_at: text(row.created_at),
      source: 'workspace',
      job_id: null,
    };
  });

  let events = [
    ...notificationEvents,
    ...trackingEvents,
    ...companyAuditEvents,
    ...invoiceStatusEvents,
    ...invoicePaymentEvents,
    ...workspaceEvents,
  ].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));

  const actorIds = [...new Set(events
    .map((event) => text(event.payload.actor_user_id))
    .filter((value): value is string => Boolean(value)))];
  if (actorIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id,full_name,email')
      .in('id', actorIds.slice(0, 500));
    const actorById = new Map((profiles ?? []).map((profile) => [String(profile.id), {
      name: text(profile.full_name),
      email: text(profile.email),
    }]));
    events = events.map((event) => {
      const actorId = text(event.payload.actor_user_id);
      const actor = actorId ? actorById.get(actorId) : null;
      return actor
        ? {
            ...event,
            payload: {
              ...event.payload,
              actor_name: actor.name,
              actor_email: actor.email,
            },
          }
        : event;
    });
  }

  events = events.slice(0, 2500);
  return json(200, {
    events,
    generatedAt: new Date().toISOString(),
    sources: {
      notifications: notificationEvents.length,
      tracking: trackingEvents.length,
      companyAudit: companyAuditEvents.length,
      invoiceStatus: invoiceStatusEvents.length,
      invoicePayment: invoicePaymentEvents.length,
      workspace: workspaceEvents.length,
    },
    note: 'Verified operational, company, finance and workspace events are combined. Login/logout events are not fabricated when no verified login-audit source is exposed.',
  });
}
