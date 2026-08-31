import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '@/app/api/_lib/supabaseAdmin';
import { verifyPlatformOwner } from '@/app/api/super-admin/_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const OPTIONAL_SCHEMA_CODES = new Set(['42P01', 'PGRST202', 'PGRST204', 'PGRST205', '42703']);

const isOptionalSchemaError = (error: { code?: string } | null | undefined) => Boolean(error?.code && OPTIONAL_SCHEMA_CODES.has(error.code));
const today = () => new Date().toISOString().slice(0, 10);

type Result<T> = { data: T; available: boolean; note?: string };

async function optionalRows<T>(promise: PromiseLike<{ data: T[] | null; error: { code?: string; message: string } | null }>, label: string): Promise<Result<T[]>> {
  const result = await promise;
  if (!result.error) return { data: result.data ?? [], available: true };
  if (isOptionalSchemaError(result.error)) return { data: [], available: false, note: `${label} schema is not available in this environment.` };
  throw new Error(`${label}: ${result.error.message}`);
}

async function optionalCount(table: string, column: string, id: string): Promise<number | null> {
  if (!supabaseAdmin) return null;
  const result = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq(column, id);
  if (result.error) return null;
  return result.count ?? 0;
}

export async function GET(request: NextRequest, context: { params: Promise<{ entityId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { entityId: rawId } = await context.params;
  const entityId = decodeURIComponent(rawId).trim();
  if (!entityId || entityId.length > 240) return respond(400, { error: 'Invalid company identifier.' });

  const companyResult = await supabaseAdmin
    .from('companies')
    .select('id, name, legal_name, trading_name, status, company_type, company_number, vat_number, email, phone, website, city, postcode, country, xd_id, created_at, updated_at')
    .eq('id', entityId)
    .maybeSingle();
  if (companyResult.error) return respond(500, { error: companyResult.error.message });
  if (!companyResult.data) return respond(404, { error: 'Company not found.' });
  const company = companyResult.data;

  const [members, drivers, vehicles, postedJobs, awardedJobs, invoices, quotes, bids, tickets, invoiceDisputes, audit, cases, onboarding] = await Promise.all([
    optionalRows(supabaseAdmin.from('company_memberships').select('user_id, invited_email, role_in_company, status, created_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Company memberships'),
    optionalRows(supabaseAdmin.from('drivers').select('id, user_id, display_name, full_name, name, email, status, availability_status, driver_type, reg_number, created_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Drivers'),
    optionalRows(supabaseAdmin.from('vehicles').select('id, assigned_driver_id, reg, registration, reg_plate, make, model, vehicle_type, status, current_status, is_available, is_tracked, last_tracked_at, created_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Vehicles'),
    optionalRows(supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status, current_status, pickup_location, delivery_location, assigned_driver_id, vehicle_id, agreed_rate_gbp, currency, created_at, completed_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Posted jobs'),
    optionalRows(supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status, current_status, pickup_location, delivery_location, assigned_driver_id, vehicle_id, agreed_rate_gbp, currency, created_at, completed_at').eq('awarded_carrier_company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Awarded jobs'),
    optionalRows(supabaseAdmin.from('invoices').select('id, invoice_number, job_id, status, payment_status, amount, total, currency, due_date, paid_at, created_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Invoices'),
    optionalRows(supabaseAdmin.from('quotes').select('id, status, amount, currency, customer_name, pickup_location, delivery_location, created_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Quotes'),
    optionalRows(supabaseAdmin.from('job_bids').select('id, job_id, bidder_driver_id, quote_vehicle_id, status, amount, amount_gbp, bid_price_gbp, currency, created_at').eq('bidder_company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Marketplace bids'),
    optionalRows(supabaseAdmin.from('support_tickets').select('id, subject, category, priority, status, resolution_note, created_at, updated_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Support tickets'),
    optionalRows(supabaseAdmin.from('invoice_disputes').select('id, invoice_id, reason, status, resolution_note, created_at, resolved_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Invoice disputes'),
    optionalRows(supabaseAdmin.from('owner_audit_log').select('id, actor_user_id, target_type, target_id, target_name, target_company_id, action_type, reason, metadata, created_at').eq('target_company_id', entityId).order('created_at', { ascending: false }).limit(100), 'Owner audit'),
    optionalRows(supabaseAdmin.from('platform_cases').select('id, reference, source, case_type, severity, status, title, entity_type, entity_id, assigned_to_user_id, created_at, updated_at').eq('company_id', entityId).order('updated_at', { ascending: false }).limit(100), 'Platform cases'),
    optionalRows(supabaseAdmin.from('onboarding_applications').select('id, user_id, email, account_type, status, current_step, completion_percentage, risk_status, risk_reason, company_id, created_at, submitted_at, last_activity_at').eq('company_id', entityId).order('last_activity_at', { ascending: false }).limit(25), 'Onboarding applications'),
  ]);

  const memberUserIds = members.data.map((row) => String((row as { user_id?: string }).user_id ?? '')).filter(Boolean);
  const profiles = memberUserIds.length
    ? await optionalRows(supabaseAdmin.from('profiles').select('user_id, full_name, role, status, phone, xd_id, created_at, updated_at').in('user_id', memberUserIds), 'Member profiles')
    : { data: [], available: true } as Result<Record<string, unknown>[]>;
  const profileById = new Map(profiles.data.map((row) => [String((row as { user_id?: string }).user_id), row]));

  const driverIds = drivers.data.map((row) => String((row as { id?: string }).id ?? '')).filter(Boolean);
  const vehicleIds = vehicles.data.map((row) => String((row as { id?: string }).id ?? '')).filter(Boolean);
  const invoiceIds = invoices.data.map((row) => String((row as { id?: string }).id ?? '')).filter(Boolean);
  const onboardingIds = onboarding.data.map((row) => String((row as { id?: string }).id ?? '')).filter(Boolean);

  const [driverDocs, vehicleDocs, payments, companyNotifications, onboardingNotifications] = await Promise.all([
    driverIds.length ? optionalRows(supabaseAdmin.from('driver_documents').select('id, driver_id, doc_type, status, expiry_date, issued_date, created_at').in('driver_id', driverIds).order('created_at', { ascending: false }).limit(250), 'Driver documents') : Promise.resolve({ data: [], available: true } as Result<Record<string, unknown>[]>),
    vehicleIds.length ? optionalRows(supabaseAdmin.from('vehicle_documents').select('id, vehicle_id, doc_type, status, expiry_date, issued_date, created_at').in('vehicle_id', vehicleIds).order('created_at', { ascending: false }).limit(250), 'Vehicle documents') : Promise.resolve({ data: [], available: true } as Result<Record<string, unknown>[]>),
    invoiceIds.length ? optionalRows(supabaseAdmin.from('invoice_payment_history').select('id, invoice_id, amount, currency, settlement_method, external_reference, paid_at, created_at').in('invoice_id', invoiceIds).order('created_at', { ascending: false }).limit(250), 'Payment history') : Promise.resolve({ data: [], available: true } as Result<Record<string, unknown>[]>),
    optionalRows(supabaseAdmin.from('notification_events').select('id, event_type, entity_type, entity_id, recipient_user_id, status, created_at, processed_at').eq('entity_type', 'company').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(100), 'Company notifications'),
    onboardingIds.length ? optionalRows(supabaseAdmin.from('notification_events').select('id, event_type, entity_type, entity_id, recipient_user_id, status, created_at, processed_at').eq('entity_type', 'onboarding_application').in('entity_id', onboardingIds).order('created_at', { ascending: false }).limit(100), 'Onboarding notifications') : Promise.resolve({ data: [], available: true } as Result<Record<string, unknown>[]>),
  ]);

  const latestOnboarding = onboarding.data[0] as Record<string, unknown> | undefined;
  let missingDocuments: string[] = [];
  let missingDocumentsAvailable = true;
  let missingDocumentsNote: string | null = null;
  if (latestOnboarding?.id) {
    const missing = await supabaseAdmin.rpc('get_missing_onboarding_documents', { p_application_id: latestOnboarding.id });
    if (missing.error) {
      missingDocumentsAvailable = false;
      missingDocumentsNote = 'Canonical onboarding missing-document preflight is unavailable.';
    } else {
      missingDocuments = (missing.data ?? []).map((row: Record<string, unknown>) => String(row.doc_type ?? row.required_doc_type ?? row.document_type ?? 'required_document'));
    }
  }

  const allDocs = [...driverDocs.data, ...vehicleDocs.data] as Array<Record<string, unknown>>;
  const todayValue = today();
  const expiredDocs = allDocs.filter((row) => typeof row.expiry_date === 'string' && row.expiry_date < todayValue);
  const pendingDocs = allDocs.filter((row) => String(row.status ?? '').toLowerCase() === 'pending');
  const rejectedDocs = allDocs.filter((row) => String(row.status ?? '').toLowerCase() === 'rejected');
  const openTickets = tickets.data.filter((row) => !['resolved', 'closed'].includes(String((row as Record<string, unknown>).status ?? '').toLowerCase()));
  const openCases = cases.data.filter((row) => !['resolved', 'closed'].includes(String((row as Record<string, unknown>).status ?? '').toLowerCase()));
  const unpaidInvoices = invoices.data.filter((row) => !['paid', 'settled'].includes(String((row as Record<string, unknown>).payment_status ?? '').toLowerCase()));
  const activeJobs = [...postedJobs.data, ...awardedJobs.data].filter((row) => !['delivered', 'completed', 'cancelled', 'canceled'].includes(String((row as Record<string, unknown>).current_status ?? (row as Record<string, unknown>).status ?? '').toLowerCase()));
  const notifications = [...companyNotifications.data, ...onboardingNotifications.data] as Array<Record<string, unknown>>;
  const failedNotifications = notifications.filter((row) => String(row.status ?? '').toLowerCase() === 'failed');

  const counts = await Promise.all([
    optionalCount('company_memberships', 'company_id', entityId),
    optionalCount('drivers', 'company_id', entityId),
    optionalCount('vehicles', 'company_id', entityId),
    optionalCount('jobs', 'company_id', entityId),
    optionalCount('jobs', 'awarded_carrier_company_id', entityId),
    optionalCount('invoices', 'company_id', entityId),
    optionalCount('support_tickets', 'company_id', entityId),
  ]);

  return respond(200, {
    company,
    summary: {
      onboardingStatus: latestOnboarding?.status ?? null,
      onboardingStep: latestOnboarding?.current_step ?? null,
      onboardingCompletion: Number(latestOnboarding?.completion_percentage ?? 0),
      onboardingRisk: latestOnboarding?.risk_status ?? null,
      missingOnboardingDocuments: missingDocuments.length,
      documentIssues: pendingDocs.length + rejectedDocs.length + expiredDocs.length,
      expiredDocuments: expiredDocs.length,
      pendingDocuments: pendingDocs.length,
      rejectedDocuments: rejectedDocs.length,
      members: counts[0] ?? members.data.length,
      drivers: counts[1] ?? drivers.data.length,
      vehicles: counts[2] ?? vehicles.data.length,
      postedJobs: counts[3] ?? postedJobs.data.length,
      awardedJobs: counts[4] ?? awardedJobs.data.length,
      activeJobs: activeJobs.length,
      invoices: counts[5] ?? invoices.data.length,
      unpaidInvoices: unpaidInvoices.length,
      supportTickets: counts[6] ?? tickets.data.length,
      openTickets: openTickets.length,
      openCases: openCases.length,
      failedNotifications: failedNotifications.length,
    },
    onboarding: {
      available: onboarding.available,
      latest: latestOnboarding ?? null,
      applications: onboarding.data,
      missingDocuments,
      missingDocumentsAvailable,
      note: missingDocumentsNote ?? onboarding.note ?? null,
    },
    people: {
      available: members.available && profiles.available,
      memberships: members.data.map((membership) => {
        const userId = String((membership as { user_id?: string }).user_id ?? '');
        return { ...membership, profile: userId ? profileById.get(userId) ?? null : null };
      }),
      note: members.note ?? profiles.note ?? null,
    },
    fleet: { available: drivers.available && vehicles.available, drivers: drivers.data, vehicles: vehicles.data, note: drivers.note ?? vehicles.note ?? null },
    compliance: {
      available: driverDocs.available && vehicleDocs.available,
      driverDocuments: driverDocs.data,
      vehicleDocuments: vehicleDocs.data,
      missingOnboardingDocuments: missingDocuments,
      note: driverDocs.note ?? vehicleDocs.note ?? missingDocumentsNote,
    },
    operations: { postedJobs: postedJobs.data, awardedJobs: awardedJobs.data },
    marketplace: { quotes: quotes.data, bids: bids.data },
    finance: { invoices: invoices.data, payments: payments.data, disputes: invoiceDisputes.data, note: invoices.note ?? payments.note ?? invoiceDisputes.note ?? null },
    support: { tickets: tickets.data, disputes: invoiceDisputes.data, cases: cases.data, casesAvailable: cases.available, note: tickets.note ?? invoiceDisputes.note ?? cases.note ?? null },
    notifications: { rows: notifications, note: companyNotifications.note ?? onboardingNotifications.note ?? null },
    audit: { rows: audit.data, available: audit.available, note: audit.note ?? null },
  });
}
