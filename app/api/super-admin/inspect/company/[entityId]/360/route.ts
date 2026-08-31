import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '@/app/api/_lib/supabaseAdmin';
import { verifyPlatformOwner } from '@/app/api/super-admin/_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const OPTIONAL_SCHEMA_CODES = new Set(['42P01', 'PGRST202', 'PGRST204', 'PGRST205', '42703']);

const isOptionalSchemaError = (error: { code?: string } | null | undefined) => Boolean(error?.code && OPTIONAL_SCHEMA_CODES.has(error.code));
const today = () => new Date().toISOString().slice(0, 10);

type Result<T> = { data: T; available: boolean; note?: string };
type AnyRow = Record<string, unknown>;

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

const dedupeById = <T extends AnyRow>(rows: T[]) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = typeof row.id === 'string' ? row.id : JSON.stringify(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export async function GET(request: NextRequest, context: { params: Promise<{ entityId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { entityId: rawId } = await context.params;
  const entityId = decodeURIComponent(rawId).trim();
  if (!entityId || entityId.length > 240) return respond(400, { error: 'Invalid company identifier.' });

  const companyResult = await supabaseAdmin
    .from('companies')
    .select('id, name, legal_name, trading_name, status, company_type, company_number, vat_number, email, phone, website, address_line1, address_line2, city, postcode, country, description, xd_id, international_work_approved, created_by, review_notes, reviewed_by, reviewed_at, created_at, updated_at')
    .eq('id', entityId)
    .maybeSingle();
  if (companyResult.error) return respond(500, { error: companyResult.error.message });
  if (!companyResult.data) return respond(404, { error: 'Company not found.' });
  const company = companyResult.data;

  const [
    members, drivers, vehicles, postedJobs, awardedJobs, invoices, quotes, bids,
    tickets, invoiceDisputes, audit, cases, onboarding, companyDocs, reviews, fraudCases,
  ] = await Promise.all([
    optionalRows(supabaseAdmin.from('company_memberships').select('user_id, invited_email, role_in_company, status, created_at, updated_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Company memberships'),
    optionalRows(supabaseAdmin.from('drivers').select('id, user_id, display_name, full_name, name, email, phone, status, availability_status, app_access, driver_type, reg_number, vehicle_type, can_commercial_bid, international_work_approved, last_app_login, created_at, updated_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Drivers'),
    optionalRows(supabaseAdmin.from('vehicles').select('id, assigned_driver_id, reg, registration, reg_plate, make, model, vehicle_type, status, current_status, is_available, is_tracked, current_location, last_tracked_at, international_work_approved, created_at, updated_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Vehicles'),
    optionalRows(supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status, current_status, pickup_location, delivery_location, assigned_driver_id, vehicle_id, agreed_rate_gbp, currency, exchange_visibility, created_at, completed_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Posted jobs'),
    optionalRows(supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status, current_status, pickup_location, delivery_location, assigned_driver_id, vehicle_id, agreed_rate_gbp, currency, exchange_visibility, created_at, completed_at').eq('awarded_carrier_company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Awarded jobs'),
    optionalRows(supabaseAdmin.from('invoices').select('id, company_id, buyer_company_id, supplier_company_id, invoice_number, job_id, status, payment_status, amount, total, currency, due_date, paid_at, created_at, updated_at').or(`company_id.eq.${entityId},buyer_company_id.eq.${entityId},supplier_company_id.eq.${entityId}`).order('created_at', { ascending: false }).limit(250), 'Invoices'),
    optionalRows(supabaseAdmin.from('quotes').select('id, status, amount, currency, customer_name, pickup_location, delivery_location, quote_sent_at, accepted_at, converted_at, converted_job_id, execution_mode, created_at, updated_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Quotes'),
    optionalRows(supabaseAdmin.from('job_bids').select('id, job_id, bidder_driver_id, quote_vehicle_id, status, amount, amount_gbp, bid_price_gbp, currency, created_at, updated_at').eq('bidder_company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Marketplace bids'),
    optionalRows(supabaseAdmin.from('support_tickets').select('id, subject, description, category, priority, status, assigned_to_user_id, resolution_note, resolved_at, closed_at, created_at, updated_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Support tickets'),
    optionalRows(supabaseAdmin.from('invoice_disputes').select('id, invoice_id, company_id, buyer_company_id, supplier_company_id, job_id, reason, details, status, resolution_note, created_at, resolved_at').or(`company_id.eq.${entityId},buyer_company_id.eq.${entityId},supplier_company_id.eq.${entityId}`).order('created_at', { ascending: false }).limit(250), 'Invoice disputes'),
    optionalRows(supabaseAdmin.from('owner_audit_log').select('id, actor_user_id, target_type, target_id, target_name, target_company_id, action_type, old_status, new_status, reason, metadata, created_at').eq('target_company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Owner audit'),
    optionalRows(supabaseAdmin.from('platform_cases').select('id, reference, source, case_type, severity, status, title, description, entity_type, entity_id, assigned_to_user_id, created_at, updated_at').eq('company_id', entityId).order('updated_at', { ascending: false }).limit(250), 'Platform cases'),
    optionalRows(supabaseAdmin.from('onboarding_applications').select('id, user_id, email, account_type, workspace_mode, owner_driver_workspace, status, current_step, completion_percentage, risk_status, risk_reason, review_notes, reviewed_by, reviewed_at, company_id, created_at, updated_at, submitted_at, last_activity_at').eq('company_id', entityId).order('last_activity_at', { ascending: false }).limit(50), 'Onboarding applications'),
    optionalRows(supabaseAdmin.from('company_documents').select('id, company_id, onboarding_application_id, doc_type, status, issued_date, expiry_date, reviewed_by, reviewed_at, review_notes, risk_status, risk_reasons, created_at, updated_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Company documents'),
    optionalRows(supabaseAdmin.from('reviews').select('id, company_id, job_id, reviewer_user_id, reviewed_user_id, rating, comment, created_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Reviews / complaints'),
    optionalRows(supabaseAdmin.from('fraud_review_cases').select('id, subject_user_id, subject_company_id, onboarding_application_id, matched_user_id, matched_company_id, case_type, severity, status, automatic_hold, evidence, decision_reason, assigned_to, decided_by, decided_at, created_at, updated_at').or(`subject_company_id.eq.${entityId},matched_company_id.eq.${entityId}`).order('created_at', { ascending: false }).limit(250), 'Fraud review cases'),
  ]);

  const memberUserIds = members.data.map((row) => String((row as AnyRow).user_id ?? '')).filter(Boolean);
  const governanceUserIds = [company.created_by, company.reviewed_by].map((id) => String(id ?? '')).filter(Boolean);
  const profileUserIds = Array.from(new Set([...memberUserIds, ...governanceUserIds]));
  const profiles = profileUserIds.length
    ? await optionalRows(supabaseAdmin.from('profiles').select('user_id, full_name, role, status, phone, xd_id, company_id, created_at, updated_at').in('user_id', profileUserIds), 'Member and governance profiles')
    : { data: [], available: true } as Result<AnyRow[]>;
  const profileById = new Map(profiles.data.map((row) => [String((row as AnyRow).user_id), row as AnyRow]));

  const driverIds = drivers.data.map((row) => String((row as AnyRow).id ?? '')).filter(Boolean);
  const vehicleIds = vehicles.data.map((row) => String((row as AnyRow).id ?? '')).filter(Boolean);
  const invoiceIds = invoices.data.map((row) => String((row as AnyRow).id ?? '')).filter(Boolean);
  const onboardingIds = onboarding.data.map((row) => String((row as AnyRow).id ?? '')).filter(Boolean);
  const relatedJobIds = Array.from(new Set([...postedJobs.data, ...awardedJobs.data].map((row) => String((row as AnyRow).id ?? '')).filter(Boolean)));

  const [driverDocs, vehicleDocs, payments, companyNotifications, onboardingNotifications, raisedJobDisputes, relatedJobDisputes] = await Promise.all([
    driverIds.length ? optionalRows(supabaseAdmin.from('driver_documents').select('id, driver_id, doc_type, status, expiry_date, issued_date, rejection_reason, verified_by, verified_at, risk_status, risk_reasons, created_at').in('driver_id', driverIds).order('created_at', { ascending: false }).limit(500), 'Driver documents') : Promise.resolve({ data: [], available: true } as Result<AnyRow[]>),
    vehicleIds.length ? optionalRows(supabaseAdmin.from('vehicle_documents').select('id, vehicle_id, doc_type, status, expiry_date, issued_date, rejection_reason, verified_by, verified_at, risk_status, risk_reasons, created_at').in('vehicle_id', vehicleIds).order('created_at', { ascending: false }).limit(500), 'Vehicle documents') : Promise.resolve({ data: [], available: true } as Result<AnyRow[]>),
    invoiceIds.length ? optionalRows(supabaseAdmin.from('invoice_payment_history').select('id, invoice_id, company_id, amount, currency, settlement_method, external_reference, note, status_after, paid_at, created_at').in('invoice_id', invoiceIds).order('created_at', { ascending: false }).limit(500), 'Payment history') : Promise.resolve({ data: [], available: true } as Result<AnyRow[]>),
    optionalRows(supabaseAdmin.from('notification_events').select('id, event_type, entity_type, entity_id, company_id, recipient_user_id, status, created_at, processed_at, attempt_count, last_error').eq('company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Company-bound notifications'),
    onboardingIds.length ? optionalRows(supabaseAdmin.from('notification_events').select('id, event_type, entity_type, entity_id, company_id, recipient_user_id, status, created_at, processed_at, attempt_count, last_error').eq('entity_type', 'onboarding_application').in('entity_id', onboardingIds).order('created_at', { ascending: false }).limit(250), 'Onboarding notifications') : Promise.resolve({ data: [], available: true } as Result<AnyRow[]>),
    optionalRows(supabaseAdmin.from('job_disputes').select('id, job_id, raised_by_company_id, status, description, resolution_note, resolved_by, resolved_at, created_at, updated_at').eq('raised_by_company_id', entityId).order('created_at', { ascending: false }).limit(250), 'Raised job disputes'),
    relatedJobIds.length ? optionalRows(supabaseAdmin.from('job_disputes').select('id, job_id, raised_by_company_id, status, description, resolution_note, resolved_by, resolved_at, created_at, updated_at').in('job_id', relatedJobIds).order('created_at', { ascending: false }).limit(250), 'Related job disputes') : Promise.resolve({ data: [], available: true } as Result<AnyRow[]>),
  ]);

  const latestOnboarding = onboarding.data[0] as AnyRow | undefined;
  let missingDocuments: string[] = [];
  let missingDocumentsAvailable = true;
  let missingDocumentsNote: string | null = null;
  if (latestOnboarding?.id) {
    const missing = await supabaseAdmin.rpc('get_missing_onboarding_documents', { p_application_id: latestOnboarding.id });
    if (missing.error) {
      missingDocumentsAvailable = false;
      missingDocumentsNote = 'Canonical onboarding missing-document preflight is unavailable.';
    } else {
      missingDocuments = (missing.data ?? []).map((row: AnyRow) => String(row.doc_type ?? row.required_doc_type ?? row.document_type ?? 'required_document'));
    }
  }

  const allDocs = [...companyDocs.data, ...driverDocs.data, ...vehicleDocs.data] as AnyRow[];
  const todayValue = today();
  const expiredDocs = allDocs.filter((row) => typeof row.expiry_date === 'string' && row.expiry_date < todayValue);
  const pendingDocs = allDocs.filter((row) => String(row.status ?? '').toLowerCase() === 'pending');
  const rejectedDocs = allDocs.filter((row) => String(row.status ?? '').toLowerCase() === 'rejected');
  const riskDocs = allDocs.filter((row) => !['', 'clear', 'none', 'ok'].includes(String(row.risk_status ?? '').toLowerCase()));
  const openTickets = tickets.data.filter((row) => !['resolved', 'closed'].includes(String((row as AnyRow).status ?? '').toLowerCase()));
  const openCases = cases.data.filter((row) => !['resolved', 'closed'].includes(String((row as AnyRow).status ?? '').toLowerCase()));
  const openFraudCases = fraudCases.data.filter((row) => !['cleared', 'dismissed', 'closed', 'resolved'].includes(String((row as AnyRow).status ?? '').toLowerCase()));
  const unpaidInvoices = invoices.data.filter((row) => !['paid', 'settled'].includes(String((row as AnyRow).payment_status ?? '').toLowerCase()));
  const activeJobs = dedupeById([...postedJobs.data, ...awardedJobs.data] as AnyRow[]).filter((row) => !['delivered', 'completed', 'cancelled', 'canceled'].includes(String(row.current_status ?? row.status ?? '').toLowerCase()));
  const notifications = dedupeById([...companyNotifications.data, ...onboardingNotifications.data] as AnyRow[]);
  const failedNotifications = notifications.filter((row) => String(row.status ?? '').toLowerCase() === 'failed');
  const jobDisputes = dedupeById([...raisedJobDisputes.data, ...relatedJobDisputes.data] as AnyRow[]);
  const openJobDisputes = jobDisputes.filter((row) => !['resolved', 'closed'].includes(String(row.status ?? '').toLowerCase()));
  const openInvoiceDisputes = invoiceDisputes.data.filter((row) => !['resolved', 'closed'].includes(String((row as AnyRow).status ?? '').toLowerCase()));
  const lowReviews = reviews.data.filter((row) => Number((row as AnyRow).rating ?? 5) <= 2);

  const counts = await Promise.all([
    optionalCount('company_memberships', 'company_id', entityId),
    optionalCount('drivers', 'company_id', entityId),
    optionalCount('vehicles', 'company_id', entityId),
    optionalCount('jobs', 'company_id', entityId),
    optionalCount('jobs', 'awarded_carrier_company_id', entityId),
    optionalCount('support_tickets', 'company_id', entityId),
    optionalCount('company_documents', 'company_id', entityId),
  ]);

  return respond(200, {
    company: {
      ...company,
      created_by_profile: company.created_by ? profileById.get(String(company.created_by)) ?? null : null,
      reviewed_by_profile: company.reviewed_by ? profileById.get(String(company.reviewed_by)) ?? null : null,
    },
    summary: {
      onboardingStatus: latestOnboarding?.status ?? null,
      onboardingStep: latestOnboarding?.current_step ?? null,
      onboardingCompletion: Number(latestOnboarding?.completion_percentage ?? 0),
      onboardingRisk: latestOnboarding?.risk_status ?? null,
      missingOnboardingDocuments: missingDocuments.length,
      companyDocuments: counts[6] ?? companyDocs.data.length,
      documentIssues: pendingDocs.length + rejectedDocs.length + expiredDocs.length + riskDocs.length,
      expiredDocuments: expiredDocs.length,
      pendingDocuments: pendingDocs.length,
      rejectedDocuments: rejectedDocs.length,
      riskyDocuments: riskDocs.length,
      members: counts[0] ?? members.data.length,
      drivers: counts[1] ?? drivers.data.length,
      vehicles: counts[2] ?? vehicles.data.length,
      postedJobs: counts[3] ?? postedJobs.data.length,
      awardedJobs: counts[4] ?? awardedJobs.data.length,
      activeJobs: activeJobs.length,
      invoices: invoices.data.length,
      unpaidInvoices: unpaidInvoices.length,
      supportTickets: counts[5] ?? tickets.data.length,
      openTickets: openTickets.length,
      openCases: openCases.length,
      openFraudCases: openFraudCases.length,
      openJobDisputes: openJobDisputes.length,
      openInvoiceDisputes: openInvoiceDisputes.length,
      lowRatedReviews: lowReviews.length,
      failedNotifications: failedNotifications.length,
      auditEvents: audit.data.length,
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
        const userId = String((membership as AnyRow).user_id ?? '');
        return { ...membership, profile: userId ? profileById.get(userId) ?? null : null };
      }),
      governanceProfiles: {
        createdBy: company.created_by ? profileById.get(String(company.created_by)) ?? null : null,
        reviewedBy: company.reviewed_by ? profileById.get(String(company.reviewed_by)) ?? null : null,
      },
      note: members.note ?? profiles.note ?? null,
    },
    fleet: { available: drivers.available && vehicles.available, drivers: drivers.data, vehicles: vehicles.data, note: drivers.note ?? vehicles.note ?? null },
    compliance: {
      available: companyDocs.available && driverDocs.available && vehicleDocs.available && fraudCases.available,
      companyDocuments: companyDocs.data,
      driverDocuments: driverDocs.data,
      vehicleDocuments: vehicleDocs.data,
      fraudCases: fraudCases.data,
      missingOnboardingDocuments: missingDocuments,
      note: companyDocs.note ?? driverDocs.note ?? vehicleDocs.note ?? fraudCases.note ?? missingDocumentsNote,
    },
    operations: { postedJobs: postedJobs.data, awardedJobs: awardedJobs.data, jobDisputes },
    marketplace: { quotes: quotes.data, bids: bids.data, disputes: jobDisputes },
    finance: { invoices: invoices.data, payments: payments.data, disputes: invoiceDisputes.data, note: invoices.note ?? payments.note ?? invoiceDisputes.note ?? null },
    support: {
      tickets: tickets.data,
      complaints: reviews.data,
      invoiceDisputes: invoiceDisputes.data,
      jobDisputes,
      cases: cases.data,
      fraudCases: fraudCases.data,
      casesAvailable: cases.available,
      note: tickets.note ?? reviews.note ?? invoiceDisputes.note ?? raisedJobDisputes.note ?? relatedJobDisputes.note ?? cases.note ?? fraudCases.note ?? null,
    },
    notifications: { rows: notifications, note: companyNotifications.note ?? onboardingNotifications.note ?? null },
    audit: { rows: audit.data, available: audit.available, note: audit.note ?? null },
  });
}
