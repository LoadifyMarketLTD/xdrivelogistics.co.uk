import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { resolveWorkspaceRole, type WorkspaceRole } from '../../../../lib/workspaceRole';
import { resolveAuthContext } from '../../../../lib/authContextResolver';
import { normalizeAuthMembershipRows, resolveAuthActiveCompanySelection, type AuthMembershipQueryRow } from '../../../../lib/authActiveCompanyContext';
import { deriveOperationalActionCentreItems } from '../../../../lib/actionCentreOperational';
import {
  getActionCentreRoute,
  isActionCentreEventVisibleToRole,
  resolveRoleScopedHref,
  type ActionCentreRole,
} from '../../../components/workspace/actionCentreConfig';
import { isActionCentreRoleAllowed } from '../../../components/workspace/actionCentreAuthorisation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

const json = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
  });

const parseRole = (value: string | null): ActionCentreRole | null => {
  if (value === 'admin' || value === 'broker' || value === 'customer' || value === 'driver' || value === 'platform_owner') return value;
  return null;
};

const normaliseEventLabel = (eventType: unknown): string => {
  const value = typeof eventType === 'string' ? eventType.trim() : '';
  if (!value) return 'Activity update';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
};

const inferStatus = (status: unknown): string => {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return value || 'pending';
};

type AuthoritativeActionContext = {
  resolvedRole: WorkspaceRole;
  companyId: string | null;
  driverId: string | null;
};

async function resolveAuthoritativeActionContext(user: { id: string; app_metadata?: Record<string, unknown> | null }): Promise<{ ok: true; context: AuthoritativeActionContext } | { ok: false; status: number; error: string }> {
  if (!supabaseAdmin) return { ok: false, status: 503, error: 'Authoritative workspace context is unavailable.' };

  const [profileResult, membershipsResult, driversResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id,company_id,role,status,is_driver').eq('user_id', user.id).maybeSingle(),
    supabaseAdmin.from('company_memberships').select('id,company_id,user_id,role_in_company,status,companies(id,name,company_type,status)').eq('user_id', user.id).eq('status', 'active'),
    supabaseAdmin.from('drivers').select('id,user_id,company_id,status,app_access').eq('user_id', user.id),
  ]);

  if (profileResult.error || membershipsResult.error || driversResult.error) {
    return { ok: false, status: 500, error: 'Unable to resolve authoritative workspace context.' };
  }

  const profile = profileResult.data as { company_id?: string | null; role?: string | null; status?: string | null; is_driver?: boolean | null } | null;
  if (profile?.status && String(profile.status).toLowerCase() !== 'active') {
    return { ok: false, status: 403, error: 'Account is not active.' };
  }

  const memberships = normalizeAuthMembershipRows((membershipsResult.data ?? []) as AuthMembershipQueryRow[]);
  const selection = memberships.length
    ? resolveAuthActiveCompanySelection({ memberships, preferredCompanyId: profile?.company_id ?? null })
    : null;

  if (selection && !selection.ok) {
    return {
      ok: false,
      status: selection.error === 'active_company_required' ? 409 : 403,
      error: selection.error === 'active_company_required'
        ? 'A single active company context is required for Action Centre.'
        : 'No active company context is available for Action Centre.',
    };
  }

  const companyId = selection?.ok ? selection.companyId : profile?.company_id ?? null;
  const membershipRole = selection?.ok ? selection.membership.role_in_company ?? null : null;
  const drivers = (driversResult.data ?? []) as Array<{ id?: string | null; company_id?: string | null; status?: string | null; app_access?: boolean | null }>;
  const scopedDriver = companyId ? drivers.find((driver) => driver.company_id === companyId) ?? null : drivers[0] ?? null;
  const appMeta = user.app_metadata ?? {};
  const trustedFallbackRole = typeof appMeta.role === 'string' ? appMeta.role : null;

  const authContext = resolveAuthContext({
    membershipRole,
    membershipCompanyId: companyId,
    profileCompanyId: profile?.company_id ?? null,
    profileRole: profile?.role ?? null,
    driverCompanyId: scopedDriver?.company_id ?? null,
    fallbackRole: trustedFallbackRole,
    isDriver: profile?.is_driver === true || Boolean(scopedDriver),
  });

  if (!authContext.role) return { ok: false, status: 403, error: 'Authoritative role could not be resolved.' };

  const resolvedRole = resolveWorkspaceRole({
    role: authContext.role,
    membershipRole,
  });

  return {
    ok: true,
    context: {
      resolvedRole,
      companyId: authContext.companyId ?? companyId,
      driverId: scopedDriver?.id ?? null,
    },
  };
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseValidator || !supabaseAdmin) {
    return json(503, { error: 'Authentication or authoritative workspace service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Missing bearer token.' });

  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Invalid session.' });

  const params = new URL(request.url).searchParams;
  const role = parseRole(params.get('role'));
  if (!role) return json(400, { error: 'Invalid role.' });

  const authoritative = await resolveAuthoritativeActionContext({
    id: authData.user.id,
    app_metadata: authData.user.app_metadata as Record<string, unknown> | null,
  });
  if (!authoritative.ok) return json(authoritative.status, { error: authoritative.error });

  const { resolvedRole, companyId, driverId } = authoritative.context;
  if (!isActionCentreRoleAllowed(role, resolvedRole)) return json(403, { error: 'Forbidden for this role.' });

  const limitValue = Number(params.get('limit') ?? '100');
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(200, Math.trunc(limitValue))) : 100;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } },
  });

  const { data: userEvents, error: userEventsError } = await client
    .from('notification_events')
    .select('id,event_type,entity_type,entity_id,status,created_at')
    .eq('recipient_user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userEventsError) return json(500, { error: 'Unable to load action centre notifications.' });

  let companyEvents: Array<Record<string, unknown>> = [];
  if (companyId) {
    const { data: scopedEvents, error: scopedEventsError } = await supabaseAdmin
      .from('notification_events')
      .select('id,event_type,entity_type,entity_id,status,created_at')
      .eq('company_id', companyId)
      .is('recipient_user_id', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (scopedEventsError) return json(500, { error: 'Unable to load company action centre notifications.' });
    companyEvents = (scopedEvents ?? []) as Array<Record<string, unknown>>;
  }

  let jobs: Array<Record<string, unknown>> = [];
  if (role !== 'platform_owner') {
    let jobsQuery = supabaseAdmin
      .from('jobs')
      .select('id,company_id,status,current_status,awarded_carrier_company_id,assigned_company_id,assigned_driver_id,vehicle_id,pod_generated,accepted_bid_id,broker_pod_review_status,customer_reference,booking_reference,delivered_at,completed_at,created_at')
      .order('created_at', { ascending: false })
      .limit(250);
    if (role === 'driver' && driverId) jobsQuery = jobsQuery.eq('assigned_driver_id', driverId);
    else if ((role === 'broker' || role === 'customer') && companyId) jobsQuery = jobsQuery.eq('company_id', companyId);
    else if (role === 'admin' && companyId) jobsQuery = jobsQuery.or(`company_id.eq.${companyId},assigned_company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`);
    else jobsQuery = jobsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    const result = await jobsQuery;
    if (result.error) return json(500, { error: 'Unable to load operational jobs for Action Centre.' });
    jobs = (result.data ?? []) as Array<Record<string, unknown>>;
  }

  const jobIds = jobs.map((job) => typeof job.id === 'string' ? job.id : null).filter((value): value is string => Boolean(value));
  let bids: Array<Record<string, unknown>> = [];
  if ((role === 'broker' || role === 'customer') && jobIds.length) {
    const result = await supabaseAdmin.from('job_bids').select('id,job_id,status,created_at').in('job_id', jobIds).limit(500);
    if (result.error) return json(500, { error: 'Unable to load quote actions for Action Centre.' });
    bids = (result.data ?? []) as Array<Record<string, unknown>>;
  }

  let invoices: Array<Record<string, unknown>> = [];
  if (companyId && (role === 'admin' || role === 'customer')) {
    let invoiceQuery = supabaseAdmin
      .from('invoices')
      .select('id,job_id,company_id,buyer_company_id,supplier_company_id,status,payment_status,due_date,created_at')
      .order('created_at', { ascending: false })
      .limit(250);
    invoiceQuery = role === 'customer'
      ? invoiceQuery.eq('buyer_company_id', companyId)
      : invoiceQuery.or(`company_id.eq.${companyId},supplier_company_id.eq.${companyId},buyer_company_id.eq.${companyId}`);
    const result = await invoiceQuery;
    if (result.error) return json(500, { error: 'Unable to load finance actions for Action Centre.' });
    invoices = (result.data ?? []) as Array<Record<string, unknown>>;
  }

  const operationalItems = role === 'platform_owner'
    ? []
    : deriveOperationalActionCentreItems({
        role,
        companyId,
        driverId,
        jobs: jobs as never[],
        bids: bids as never[],
        invoices: invoices as never[],
      });

  const notificationItems = [...(userEvents ?? []), ...companyEvents]
    .filter((row, index, all) => all.findIndex((candidate) => candidate.id === row.id) === index)
    .filter((row) => isActionCentreEventVisibleToRole(role, typeof row.event_type === 'string' ? row.event_type : null, typeof row.entity_type === 'string' ? row.entity_type : null))
    .map((row, index) => {
      const eventId = typeof row.entity_id === 'string' ? row.entity_id : typeof row.id === 'string' ? row.id : null;
      const entityType = typeof row.entity_type === 'string' ? row.entity_type : null;
      return {
        id: `${String(row.created_at ?? 'event')}-${index}`,
        event_id: eventId,
        event_type: normaliseEventLabel(row.event_type),
        entity_type: entityType,
        status: inferStatus(row.status),
        created_at: row.created_at,
        cta_href: resolveRoleScopedHref(role, entityType, eventId) || getActionCentreRoute(role, eventId),
        persistent: false,
        source: 'notification',
      };
    });

  const items = [...operationalItems.map((item) => ({ ...item, event_type: normaliseEventLabel(item.event_type) })), ...notificationItems]
    .sort((a, b) => Number(Boolean(b.persistent)) - Number(Boolean(a.persistent)) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, limit);

  return json(200, { items });
}
