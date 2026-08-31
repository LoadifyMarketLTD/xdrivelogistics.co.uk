import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const CASE_SCHEMA_UNAVAILABLE_CODES = new Set(['42P01', 'PGRST202', 'PGRST205']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SEARCH_ENTITY_TYPES = [
  'job',
  'company',
  'user',
  'driver',
  'vehicle',
  'invoice',
  'ticket',
  'dispute',
  'pod',
  'case',
] as const;

type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

type PlatformSearchResult = {
  entityType: SearchEntityType;
  entityId: string;
  reference: string;
  title: string;
  subtitle: string;
  status?: string | null;
};

type QueryResult<T> = { data: T[] | null; error: { code?: string; message: string } | null };

const normalizeTerm = (value: string) =>
  value
    .trim()
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 160);

const ilike = (value: string) => `%${value.replace(/[%_]/g, '\\$&')}%`;
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const entityKey = (result: PlatformSearchResult) => `${result.entityType}:${result.entityId}`;
const isCaseSchemaUnavailable = (error: { code?: string } | null | undefined) =>
  Boolean(error?.code && CASE_SCHEMA_UNAVAILABLE_CODES.has(error.code));

function pushUnique(target: PlatformSearchResult[], incoming: PlatformSearchResult[], limit: number) {
  const seen = new Set(target.map(entityKey));
  for (const item of incoming) {
    const key = entityKey(item);
    if (seen.has(key)) continue;
    target.push(item);
    seen.add(key);
    if (target.length >= limit) break;
  }
}

async function searchAuthUsers(term: string, perTypeLimit: number) {
  if (!supabaseAdmin) return { rows: [] as Array<{ id: string; email: string | null }>, truncated: false, error: null as string | null };

  const normalized = term.toLowerCase();
  const rows: Array<{ id: string; email: string | null }> = [];
  const perPage = 500;
  const maxPages = 40;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) return { rows, truncated: false, error: error.message };

    const users = data.users ?? [];
    for (const user of users) {
      const email = user.email ?? null;
      if (email?.toLowerCase().includes(normalized)) {
        rows.push({ id: user.id, email });
        if (rows.length >= perTypeLimit) return { rows, truncated: users.length === perPage || page > 1, error: null };
      }
    }

    if (users.length < perPage) return { rows, truncated: false, error: null };
  }

  return { rows, truncated: true, error: null };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('q') ?? '';
  const query = normalizeTerm(rawQuery);
  const requestedLimit = Number(searchParams.get('limit') ?? '50');
  const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 50));
  const perTypeLimit = Math.min(20, Math.max(5, Math.ceil(limit / 2)));

  if (query.length < 2) {
    return respond(400, { error: 'Search query must contain at least 2 characters.' });
  }

  const pattern = ilike(query);
  const isUuid = UUID_PATTERN.test(query);
  const results: PlatformSearchResult[] = [];
  const unavailableSources: Array<{ entityType: SearchEntityType; reason: string }> = [];
  const partialSources: Array<{ entityType: SearchEntityType; reason: string }> = [];

  const [
    jobsResult,
    companiesResult,
    profilesResult,
    driversResult,
    vehiclesResult,
    invoicesResult,
    ticketsResult,
    disputesResult,
    casesResult,
    authUsersResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('jobs')
      .select('id, status, title, pickup_location, delivery_location, load_id, load_ref, load_reference, booking_reference, your_ref, cust_ref, customer_ref, customer_reference, delivery_signature_data, delivery_photos, pod_photos, pod_generated')
      .or([
        `title.ilike.${pattern}`,
        `load_id.ilike.${pattern}`,
        `load_ref.ilike.${pattern}`,
        `load_reference.ilike.${pattern}`,
        `booking_reference.ilike.${pattern}`,
        `your_ref.ilike.${pattern}`,
        `cust_ref.ilike.${pattern}`,
        `customer_ref.ilike.${pattern}`,
        `customer_reference.ilike.${pattern}`,
        `pickup_location.ilike.${pattern}`,
        `delivery_location.ilike.${pattern}`,
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(perTypeLimit),
    supabaseAdmin
      .from('companies')
      .select('id, name, legal_name, trading_name, company_number, xd_id, email, status')
      .or([
        `name.ilike.${pattern}`,
        `legal_name.ilike.${pattern}`,
        `trading_name.ilike.${pattern}`,
        `company_number.ilike.${pattern}`,
        `xd_id.ilike.${pattern}`,
        `email.ilike.${pattern}`,
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(perTypeLimit),
    supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, role, status, company_id, xd_id')
      .or([
        `full_name.ilike.${pattern}`,
        `xd_id.ilike.${pattern}`,
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(perTypeLimit),
    supabaseAdmin
      .from('drivers')
      .select('id, user_id, company_id, display_name, full_name, name, email, reg_number, license_number, status, availability_status')
      .or([
        `display_name.ilike.${pattern}`,
        `full_name.ilike.${pattern}`,
        `name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `reg_number.ilike.${pattern}`,
        `license_number.ilike.${pattern}`,
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(perTypeLimit),
    supabaseAdmin
      .from('vehicles')
      .select('id, company_id, reg, registration, reg_plate, vehicle_reference, internal_reference, vin, make, model, vehicle_type, type, status, current_status')
      .or([
        `reg.ilike.${pattern}`,
        `registration.ilike.${pattern}`,
        `reg_plate.ilike.${pattern}`,
        `vehicle_reference.ilike.${pattern}`,
        `internal_reference.ilike.${pattern}`,
        `vin.ilike.${pattern}`,
        `make.ilike.${pattern}`,
        `model.ilike.${pattern}`,
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(perTypeLimit),
    supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, job_id, job_ref, customer_ref, load_id, client_name, client_email, status, payment_status, amount, currency')
      .or([
        `invoice_number.ilike.${pattern}`,
        `job_ref.ilike.${pattern}`,
        `customer_ref.ilike.${pattern}`,
        `load_id.ilike.${pattern}`,
        `client_name.ilike.${pattern}`,
        `client_email.ilike.${pattern}`,
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(perTypeLimit),
    supabaseAdmin
      .from('support_tickets')
      .select('id, subject, category, priority, status, company_id, created_at')
      .or([
        `subject.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `category.ilike.${pattern}`,
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(perTypeLimit),
    supabaseAdmin
      .from('job_disputes')
      .select('id, job_id, raised_by_company_id, status, description, created_at')
      .or(`description.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(perTypeLimit),
    supabaseAdmin
      .from('platform_cases')
      .select('id, reference, title, severity, status, entity_type, entity_id, entity_label, updated_at')
      .or([
        `reference.ilike.${pattern}`,
        `title.ilike.${pattern}`,
        `entity_id.ilike.${pattern}`,
        `entity_label.ilike.${pattern}`,
      ].join(','))
      .order('updated_at', { ascending: false })
      .limit(perTypeLimit),
    searchAuthUsers(query, perTypeLimit),
  ] as const;

  const checked = [
    ['job', jobsResult],
    ['company', companiesResult],
    ['user', profilesResult],
    ['driver', driversResult],
    ['vehicle', vehiclesResult],
    ['invoice', invoicesResult],
    ['ticket', ticketsResult],
    ['dispute', disputesResult],
  ] as const;

  for (const [entityType, source] of checked) {
    if (source.error) {
      return respond(500, { error: `Global search failed for ${entityType}: ${source.error.message}` });
    }
  }

  if (authUsersResult.error) {
    partialSources.push({ entityType: 'user', reason: `Email index unavailable: ${authUsersResult.error}` });
  } else if (authUsersResult.truncated) {
    partialSources.push({ entityType: 'user', reason: 'Email search reached the bounded Auth scan limit; matching profile/name results remain authoritative.' });
  }

  if (casesResult.error) {
    if (isCaseSchemaUnavailable(casesResult.error)) {
      unavailableSources.push({ entityType: 'case', reason: 'Platform Case Centre schema is not applied in this environment.' });
    } else {
      return respond(500, { error: `Global search failed for case: ${casesResult.error.message}` });
    }
  }

  const jobs = (jobsResult.data ?? []) as Array<Record<string, unknown>>;
  const companies = (companiesResult.data ?? []) as Array<Record<string, unknown>>;
  const profiles = (profilesResult.data ?? []) as Array<Record<string, unknown>>;
  const drivers = (driversResult.data ?? []) as Array<Record<string, unknown>>;
  const vehicles = (vehiclesResult.data ?? []) as Array<Record<string, unknown>>;
  const invoices = (invoicesResult.data ?? []) as Array<Record<string, unknown>>;
  const tickets = (ticketsResult.data ?? []) as Array<Record<string, unknown>>;
  const disputes = (disputesResult.data ?? []) as Array<Record<string, unknown>>;
  const cases = (casesResult.data ?? []) as Array<Record<string, unknown>>;

  pushUnique(results, jobs.map((row) => {
    const reference = text(row.load_ref) || text(row.load_id) || text(row.load_reference) || text(row.booking_reference) || text(row.your_ref) || text(row.id);
    return {
      entityType: 'job' as const,
      entityId: text(row.id),
      reference,
      title: text(row.title) || `${text(row.pickup_location, 'Unknown pickup')} → ${text(row.delivery_location, 'Unknown delivery')}`,
      subtitle: `${text(row.pickup_location, 'Unknown pickup')} → ${text(row.delivery_location, 'Unknown delivery')}`,
      status: text(row.status) || null,
    };
  }), limit);

  pushUnique(results, companies.map((row) => ({
    entityType: 'company' as const,
    entityId: text(row.id),
    reference: text(row.xd_id) || text(row.company_number) || text(row.id),
    title: text(row.trading_name) || text(row.name) || text(row.legal_name) || 'Company',
    subtitle: [text(row.company_number), text(row.email)].filter(Boolean).join(' · ') || 'Registered company',
    status: text(row.status) || null,
  })), limit);

  const profileByUserId = new Map(profiles.map((profile) => [text(profile.user_id), profile]));
  const authEmailByUserId = new Map(authUsersResult.rows.map((user) => [user.id, user.email]));
  const userIds = new Set([...profileByUserId.keys(), ...authEmailByUserId.keys()]);
  const missingProfileIds = Array.from(userIds).filter((id) => id && !profileByUserId.has(id)).slice(0, perTypeLimit);
  if (missingProfileIds.length) {
    const { data: authProfiles, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, role, status, company_id, xd_id')
      .in('user_id', missingProfileIds);
    if (error) return respond(500, { error: `Global search failed for user profile resolution: ${error.message}` });
    for (const profile of (authProfiles ?? []) as Array<Record<string, unknown>>) profileByUserId.set(text(profile.user_id), profile);
  }

  pushUnique(results, Array.from(userIds).filter(Boolean).map((userId) => {
    const profile = profileByUserId.get(userId);
    const email = authEmailByUserId.get(userId) ?? null;
    return {
      entityType: 'user' as const,
      entityId: userId,
      reference: profile ? text(profile.xd_id) || userId : userId,
      title: profile ? text(profile.full_name) || email || 'Platform user' : email || 'Platform user',
      subtitle: [email, profile ? text(profile.role) : ''].filter(Boolean).join(' · ') || 'Supabase Auth identity',
      status: profile ? text(profile.status) || null : null,
    };
  }), limit);

  pushUnique(results, drivers.map((row) => ({
    entityType: 'driver' as const,
    entityId: text(row.id),
    reference: text(row.reg_number) || text(row.license_number) || text(row.id),
    title: text(row.display_name) || text(row.full_name) || text(row.name) || 'Driver',
    subtitle: [text(row.email), text(row.reg_number), text(row.availability_status)].filter(Boolean).join(' · ') || 'Driver identity',
    status: text(row.status) || null,
  })), limit);

  pushUnique(results, vehicles.map((row) => {
    const registration = text(row.registration) || text(row.reg_plate) || text(row.reg) || text(row.vehicle_reference) || text(row.id);
    return {
      entityType: 'vehicle' as const,
      entityId: text(row.id),
      reference: registration,
      title: [text(row.make), text(row.model)].filter(Boolean).join(' ') || text(row.vehicle_type) || text(row.type) || 'Vehicle',
      subtitle: [registration, text(row.vehicle_reference), text(row.internal_reference)].filter(Boolean).join(' · '),
      status: text(row.status) || text(row.current_status) || null,
    };
  }), limit);

  pushUnique(results, invoices.map((row) => ({
    entityType: 'invoice' as const,
    entityId: text(row.id),
    reference: text(row.invoice_number) || text(row.id),
    title: text(row.client_name) ? `Invoice · ${text(row.client_name)}` : 'Invoice',
    subtitle: [text(row.job_ref), row.amount != null ? `${text(row.currency, 'GBP')} ${String(row.amount)}` : ''].filter(Boolean).join(' · '),
    status: text(row.payment_status) || text(row.status) || null,
  })), limit);

  pushUnique(results, tickets.map((row) => ({
    entityType: 'ticket' as const,
    entityId: text(row.id),
    reference: text(row.id),
    title: text(row.subject) || 'Support ticket',
    subtitle: [text(row.category), text(row.priority)].filter(Boolean).join(' · ') || 'Support',
    status: text(row.status) || null,
  })), limit);

  pushUnique(results, disputes.map((row) => ({
    entityType: 'dispute' as const,
    entityId: text(row.id),
    reference: text(row.id),
    title: text(row.description).slice(0, 100) || 'Job dispute',
    subtitle: row.job_id ? `Job ${text(row.job_id)}` : 'Job dispute',
    status: text(row.status) || null,
  })), limit);

  const podRows = jobs.filter((row) =>
    Boolean(row.pod_generated)
    || Boolean(row.delivery_signature_data)
    || (Array.isArray(row.delivery_photos) && row.delivery_photos.length > 0)
    || (Array.isArray(row.pod_photos) && row.pod_photos.length > 0),
  );
  pushUnique(results, podRows.map((row) => ({
    entityType: 'pod' as const,
    entityId: text(row.id),
    reference: text(row.load_ref) || text(row.load_id) || text(row.booking_reference) || text(row.id),
    title: `POD · ${text(row.pickup_location, 'Pickup')} → ${text(row.delivery_location, 'Delivery')}`,
    subtitle: 'Proof-of-delivery evidence attached to canonical job',
    status: row.pod_generated ? 'generated' : 'evidence_present',
  })), limit);

  if (!casesResult.error) {
    pushUnique(results, cases.map((row) => ({
      entityType: 'case' as const,
      entityId: text(row.id),
      reference: text(row.reference) || text(row.id),
      title: text(row.title) || 'Platform case',
      subtitle: [text(row.severity), text(row.entity_label)].filter(Boolean).join(' · ') || 'Platform Action Centre case',
      status: text(row.status) || null,
    })), limit);
  }

  if (isUuid && results.length < limit) {
    const exactChecks = await Promise.all([
      supabaseAdmin.from('jobs').select('id, status, title, pickup_location, delivery_location, load_id, load_ref').eq('id', query).maybeSingle(),
      supabaseAdmin.from('companies').select('id, name, trading_name, company_number, xd_id, status').eq('id', query).maybeSingle(),
      supabaseAdmin.from('drivers').select('id, display_name, full_name, name, email, reg_number, status').eq('id', query).maybeSingle(),
      supabaseAdmin.from('vehicles').select('id, reg, registration, reg_plate, make, model, vehicle_type, status').eq('id', query).maybeSingle(),
      supabaseAdmin.from('invoices').select('id, invoice_number, job_ref, client_name, status, payment_status').eq('id', query).maybeSingle(),
      supabaseAdmin.from('support_tickets').select('id, subject, status, category').eq('id', query).maybeSingle(),
      supabaseAdmin.from('job_disputes').select('id, job_id, description, status').eq('id', query).maybeSingle(),
    ] as const);

    const [jobExact, companyExact, driverExact, vehicleExact, invoiceExact, ticketExact, disputeExact] = exactChecks;
    for (const source of exactChecks) {
      if (source.error) return respond(500, { error: `Exact platform entity lookup failed: ${source.error.message}` });
    }
    if (jobExact.data) pushUnique(results, [{ entityType: 'job', entityId: query, reference: text(jobExact.data.load_ref) || text(jobExact.data.load_id) || query, title: text(jobExact.data.title) || `${text(jobExact.data.pickup_location, 'Pickup')} → ${text(jobExact.data.delivery_location, 'Delivery')}`, subtitle: `${text(jobExact.data.pickup_location, 'Pickup')} → ${text(jobExact.data.delivery_location, 'Delivery')}`, status: text(jobExact.data.status) || null }], limit);
    if (companyExact.data) pushUnique(results, [{ entityType: 'company', entityId: query, reference: text(companyExact.data.xd_id) || text(companyExact.data.company_number) || query, title: text(companyExact.data.trading_name) || text(companyExact.data.name) || 'Company', subtitle: text(companyExact.data.company_number) || 'Registered company', status: text(companyExact.data.status) || null }], limit);
    if (driverExact.data) pushUnique(results, [{ entityType: 'driver', entityId: query, reference: text(driverExact.data.reg_number) || query, title: text(driverExact.data.display_name) || text(driverExact.data.full_name) || text(driverExact.data.name) || 'Driver', subtitle: [text(driverExact.data.email), text(driverExact.data.reg_number)].filter(Boolean).join(' · '), status: text(driverExact.data.status) || null }], limit);
    if (vehicleExact.data) pushUnique(results, [{ entityType: 'vehicle', entityId: query, reference: text(vehicleExact.data.registration) || text(vehicleExact.data.reg_plate) || text(vehicleExact.data.reg) || query, title: [text(vehicleExact.data.make), text(vehicleExact.data.model)].filter(Boolean).join(' ') || text(vehicleExact.data.vehicle_type) || 'Vehicle', subtitle: text(vehicleExact.data.registration) || text(vehicleExact.data.reg_plate) || text(vehicleExact.data.reg), status: text(vehicleExact.data.status) || null }], limit);
    if (invoiceExact.data) pushUnique(results, [{ entityType: 'invoice', entityId: query, reference: text(invoiceExact.data.invoice_number) || query, title: text(invoiceExact.data.client_name) ? `Invoice · ${text(invoiceExact.data.client_name)}` : 'Invoice', subtitle: text(invoiceExact.data.job_ref) || 'Invoice', status: text(invoiceExact.data.payment_status) || text(invoiceExact.data.status) || null }], limit);
    if (ticketExact.data) pushUnique(results, [{ entityType: 'ticket', entityId: query, reference: query, title: text(ticketExact.data.subject) || 'Support ticket', subtitle: text(ticketExact.data.category) || 'Support', status: text(ticketExact.data.status) || null }], limit);
    if (disputeExact.data) pushUnique(results, [{ entityType: 'dispute', entityId: query, reference: query, title: text(disputeExact.data.description).slice(0, 100) || 'Job dispute', subtitle: disputeExact.data.job_id ? `Job ${text(disputeExact.data.job_id)}` : 'Job dispute', status: text(disputeExact.data.status) || null }], limit);
  }

  return respond(200, {
    query,
    entityTypes: SEARCH_ENTITY_TYPES,
    rows: results.slice(0, limit),
    returned: Math.min(results.length, limit),
    unavailableSources,
    partialSources,
  });
}
