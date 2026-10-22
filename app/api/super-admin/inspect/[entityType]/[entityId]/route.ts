import { NextRequest, NextResponse } from 'next/server';

import { resolveDriverOperationalEligibility } from '../../../../driver/_lib/operationalEligibility';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { deriveSecureLoadIntelligence } from '../../../_lib/secureLoadIntelligence';
import { verifyPlatformOwner } from '../../../_lib/verifyPlatformOwner';
import { isTimestampFresh } from '../../../_lib/operationalMapTruth';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const CASE_SCHEMA_UNAVAILABLE_CODES = new Set(['42P01', 'PGRST202', 'PGRST205']);
const ENTITY_TYPES = new Set(['job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'ticket', 'dispute', 'pod', 'case']);

type FieldTone = 'default' | 'muted' | 'success' | 'warning' | 'danger';
type InspectorField = { key: string; label: string; value: string; copyValue?: string | null; tone?: FieldTone };
type InspectorSection = { id: string; title: string; description?: string; fields?: InspectorField[]; unavailable?: boolean; unavailableReason?: string };
type InspectorRelation = { entityType: string; entityId: string; label: string; reference?: string | null; status?: string | null };
type InspectorRelationGroup = { id: string; title: string; description?: string; rows: InspectorRelation[]; total?: number | null };

type InspectorPayload = {
  available: boolean;
  entityType: string;
  entityId: string;
  reference: string;
  title: string;
  subtitle?: string;
  status?: string | null;
  stableId: string;
  sections: InspectorSection[];
  relationshipGroups: InspectorRelationGroup[];
  liveMap?: {
    drivers: Array<{
      id: string;
      name: string;
      status: 'online' | 'busy' | 'offline' | 'sold';
      vehicle: { registration: string; label: string } | null;
      location: { lat: number | null; lng: number | null; heading: number | null; speed_mph: number | null; recorded_at: string | null; source?: string | null } | null;
    }>;
    jobs: Array<{
      id: string;
      short_id: string;
      client: string;
      status: string;
      pickup: string;
      delivery: string;
      eta: null;
      map: { pickup_lat: number | null; pickup_lng: number | null; delivery_lat: number | null; delivery_lng: number | null };
    }>;
    routes: Array<{
      id: string;
      short_id: string;
      client: string;
      status: string;
      pickup: string;
      delivery: string;
      eta: null;
      map: { pickup_lat: number | null; pickup_lng: number | null; delivery_lat: number | null; delivery_lng: number | null };
    }>;
    note?: string;
  };
  note?: string;
};

const value = (input: unknown, fallback = '—') => {
  if (input === null || input === undefined || input === '') return fallback;
  if (typeof input === 'boolean') return input ? 'Yes' : 'No';
  if (typeof input === 'object') return JSON.stringify(input);
  return String(input);
};
const optional = (input: unknown) => input === null || input === undefined || input === '' ? null : String(input);
const field = (key: string, label: string, input: unknown, tone?: FieldTone): InspectorField => ({ key, label, value: value(input), copyValue: optional(input), tone });
const relation = (entityType: string, entityId: unknown, label: string, reference?: unknown, status?: unknown): InspectorRelation | null => {
  const id = optional(entityId);
  if (!id) return null;
  return { entityType, entityId: id, label, reference: optional(reference), status: optional(status) };
};
const compactRelations = (rows: Array<InspectorRelation | null>) => rows.filter((row): row is InspectorRelation => Boolean(row));
const isCaseSchemaUnavailable = (error: { code?: string } | null | undefined) => Boolean(error?.code && CASE_SCHEMA_UNAVAILABLE_CODES.has(error.code));

async function companySummary(companyId: string | null | undefined) {
  if (!supabaseAdmin || !companyId) return null;
  const { data, error } = await supabaseAdmin.from('companies').select('id, name, trading_name, legal_name, status, xd_id, company_number').eq('id', companyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function profileSummary(userId: string | null | undefined) {
  if (!supabaseAdmin || !userId) return null;
  const { data, error } = await supabaseAdmin.from('profiles').select('user_id, full_name, role, status, company_id, xd_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function countRows(table: string, column: string, id: string) {
  if (!supabaseAdmin) return null;
  const { count, error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq(column, id);
  if (error) return null;
  return count ?? 0;
}

async function inspectCompany(entityId: string): Promise<InspectorPayload | null> {
  if (!supabaseAdmin) return null;
  const { data: company, error } = await supabaseAdmin
    .from('companies')
    .select('id, name, legal_name, trading_name, status, company_type, company_number, vat_number, email, phone, contact_name, website, city, postcode, country, xd_id, created_at, updated_at')
    .eq('id', entityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!company) return null;

  const [members, drivers, vehicles, postingJobs, awardedJobs, invoices, memberCount, driverCount, vehicleCount, postingJobCount, awardedJobCount, invoiceCount] = await Promise.all([
    supabaseAdmin.from('company_memberships').select('user_id, invited_email, role_in_company, status, created_at').eq('company_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('drivers').select('id, display_name, full_name, name, status, reg_number').eq('company_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('vehicles').select('id, reg, registration, reg_plate, make, model, status, current_status').eq('company_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status').eq('company_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status').eq('awarded_carrier_company_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('invoices').select('id, invoice_number, status, payment_status').eq('company_id', entityId).order('created_at', { ascending: false }).limit(25),
    countRows('company_memberships', 'company_id', entityId),
    countRows('drivers', 'company_id', entityId),
    countRows('vehicles', 'company_id', entityId),
    countRows('jobs', 'company_id', entityId),
    countRows('jobs', 'awarded_carrier_company_id', entityId),
    countRows('invoices', 'company_id', entityId),
  ]);
  for (const result of [members, drivers, vehicles, postingJobs, awardedJobs, invoices]) if (result.error) throw new Error(result.error.message);

  return {
    available: true, entityType: 'company', entityId, stableId: entityId,
    reference: value(company.xd_id ?? company.company_number ?? company.id),
    title: value(company.trading_name ?? company.name ?? company.legal_name, 'Company'),
    subtitle: [optional(company.company_number), optional(company.company_type), optional(company.email)].filter(Boolean).join(' · '),
    status: optional(company.status),
    sections: [
      { id: 'identity', title: 'Company identity', fields: [field('legal_name', 'Legal name', company.legal_name), field('trading_name', 'Trading name', company.trading_name ?? company.name), field('company_number', 'Company number', company.company_number), field('vat_number', 'VAT number', company.vat_number), field('xd_id', 'XDrive ID', company.xd_id), field('company_type', 'Company type', company.company_type), field('contact_name', 'Contact person', company.contact_name)] },
      { id: 'contact', title: 'Contact and registered location', fields: [field('email', 'Email', company.email), field('phone', 'Phone', company.phone), field('website', 'Website', company.website), field('city', 'City', company.city), field('postcode', 'Postcode', company.postcode), field('country', 'Country', company.country)] },
      { id: 'platform', title: 'Platform state', fields: [field('status', 'Status', company.status), field('created_at', 'Created', company.created_at), field('updated_at', 'Updated', company.updated_at), field('members', 'Memberships', memberCount), field('drivers', 'Drivers', driverCount), field('vehicles', 'Vehicles', vehicleCount), field('posting_jobs', 'Jobs posted', postingJobCount), field('awarded_jobs', 'Jobs awarded', awardedJobCount), field('invoices', 'Invoices', invoiceCount)] },
    ],
    relationshipGroups: [
      { id: 'members', title: 'Users / memberships', total: memberCount, rows: compactRelations((members.data ?? []).map((row) => relation('user', row.user_id, row.invited_email || `${row.role_in_company ?? 'member'} user`, row.invited_email, row.status))) },
      { id: 'drivers', title: 'Drivers', total: driverCount, rows: compactRelations((drivers.data ?? []).map((row) => relation('driver', row.id, row.display_name ?? row.full_name ?? row.name ?? 'Driver', row.reg_number, row.status))) },
      { id: 'vehicles', title: 'Vehicles', total: vehicleCount, rows: compactRelations((vehicles.data ?? []).map((row) => relation('vehicle', row.id, [row.make, row.model].filter(Boolean).join(' ') || 'Vehicle', row.registration ?? row.reg_plate ?? row.reg, row.status ?? row.current_status))) },
      { id: 'posted-jobs', title: 'Recently posted jobs', total: postingJobCount, rows: compactRelations((postingJobs.data ?? []).map((row) => relation('job', row.id, row.title ?? 'Job', row.load_ref ?? row.load_id, row.status))) },
      { id: 'awarded-jobs', title: 'Recently awarded execution', total: awardedJobCount, rows: compactRelations((awardedJobs.data ?? []).map((row) => relation('job', row.id, row.title ?? 'Job', row.load_ref ?? row.load_id, row.status))) },
      { id: 'invoices', title: 'Invoices', total: invoiceCount, rows: compactRelations((invoices.data ?? []).map((row) => relation('invoice', row.id, row.invoice_number ?? 'Invoice', row.invoice_number, row.payment_status ?? row.status))) },
    ],
  };
}

async function inspectUser(entityId: string): Promise<InspectorPayload | null> {
  if (!supabaseAdmin) return null;
  const [{ data: profile, error: profileError }, authResult, memberships, driver] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id, full_name, role, status, phone, company_id, xd_id, created_at, updated_at, is_driver, is_internal_account').eq('user_id', entityId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(entityId),
    supabaseAdmin.from('company_memberships').select('company_id, role_in_company, status, invited_email, created_at, companies:company_id(id, name, status, xd_id)').eq('user_id', entityId).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('drivers').select('id, display_name, full_name, name, status, company_id, reg_number').eq('user_id', entityId).maybeSingle(),
  ]);
  if (profileError) throw new Error(profileError.message);
  if (authResult.error && !profile) return null;
  if (memberships.error) throw new Error(memberships.error.message);
  if (driver.error) throw new Error(driver.error.message);
  const authUser = authResult.data.user ?? null;
  if (!profile && !authUser) return null;
  const primaryCompany = profile?.company_id ? await companySummary(profile.company_id) : null;

  return {
    available: true, entityType: 'user', entityId, stableId: entityId,
    reference: value(profile?.xd_id ?? entityId),
    title: value(profile?.full_name ?? authUser?.email, 'Platform user'),
    subtitle: [authUser?.email ?? null, profile?.role ?? null].filter(Boolean).join(' · '),
    status: optional(profile?.status),
    sections: [
      { id: 'identity', title: 'Application identity', fields: [field('full_name', 'Name', profile?.full_name), field('email', 'Auth email', authUser?.email), field('role', 'Profile role', profile?.role), field('status', 'Profile status', profile?.status), field('xd_id', 'XDrive ID', profile?.xd_id), field('phone', 'Phone', profile?.phone)] },
      { id: 'authority', title: 'Authority context', description: 'Profile role and memberships are shown independently so Platform authority is not confused with tenant authority.', fields: [field('is_internal', 'Internal account', profile?.is_internal_account), field('is_driver', 'Driver flag', profile?.is_driver), field('primary_company', 'Primary company', primaryCompany?.name), field('auth_created', 'Auth created', authUser?.created_at), field('last_sign_in', 'Last sign-in', authUser?.last_sign_in_at)] },
    ],
    relationshipGroups: [
      { id: 'memberships', title: 'Company memberships', rows: compactRelations((memberships.data ?? []).map((row) => { const company = row.companies as { id?: string; name?: string; status?: string; xd_id?: string } | null; return relation('company', company?.id ?? row.company_id, `${company?.name ?? 'Company'} · ${row.role_in_company ?? 'member'}`, company?.xd_id, row.status ?? company?.status); })) },
      { id: 'driver', title: 'Driver identity', rows: driver.data ? compactRelations([relation('driver', driver.data.id, driver.data.display_name ?? driver.data.full_name ?? driver.data.name ?? 'Driver', driver.data.reg_number, driver.data.status)]) : [] },
    ],
  };
}

async function inspectDriver(entityId: string): Promise<InspectorPayload | null> {
  if (!supabaseAdmin) return null;

  const { data: driver, error } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, company_id, display_name, full_name, name, email, phone, status, is_active, availability_status, app_access, reg_number, vehicle_type, license_number, driver_type, international_work_approved, can_commercial_bid, last_app_login, future_position, future_position_date, future_position_until, future_availability_notes, destination_priority_enabled, destination_radius_miles, must_change_password, notes, created_at, updated_at')
    .eq('id', entityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!driver) return null;

  const [
    company,
    profile,
    authResult,
    vehicles,
    jobs,
    latestLocation,
    availabilityPresence,
    driverDocs,
    onboardingApps,
    bids,
    reviews,
    notifications,
    loadAlertPreference,
    vehicleCount,
    jobCount,
    bidCount,
    reviewCount,
    documentCount,
  ] = await Promise.all([
    companySummary(driver.company_id),
    profileSummary(driver.user_id),
    driver.user_id ? supabaseAdmin.auth.admin.getUserById(driver.user_id) : Promise.resolve({ data: { user: null }, error: null }),
    supabaseAdmin.from('vehicles').select('id, reg, registration, reg_plate, make, model, vehicle_type, type, status, current_status, is_available, is_tracked, last_tracked_at, telematics_id, international_work_approved, payload_kg, pallets_capacity, has_tail_lift, equipment').eq('assigned_driver_id', entityId).order('updated_at', { ascending: false }).limit(50),
    supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status, current_status, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, pickup_lat, pickup_lng, delivery_lat, delivery_lng, vehicle_id, agreed_rate_gbp, budget_amount, currency, delivered_at, completed_at, created_at').eq('assigned_driver_id', entityId).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('driver_locations').select('id, job_id, vehicle_id, lat, lng, speed_mph, heading, source, source_provider, recorded_at').eq('driver_id', entityId).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('driver_availability_presence').select('driver_id, company_id, visibility, exact_lat, exact_lng, available_until, recorded_at, updated_at').eq('driver_id', entityId).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('driver_documents').select('id, doc_type, status, issued_date, expiry_date, rejection_reason, verified_by, verified_at, holder_name, document_number_last4, date_of_birth, risk_status, risk_reasons, created_at').eq('driver_id', entityId).order('created_at', { ascending: false }).limit(100),
    driver.user_id
      ? supabaseAdmin.from('onboarding_applications').select('id, status, current_step, completion_percentage, risk_status, risk_reason, submitted_at, reviewed_at, last_activity_at, created_at').eq('user_id', driver.user_id).order('created_at', { ascending: false }).limit(25)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('job_bids').select('id, job_id, bidder_company_id, quote_vehicle_id, status, amount_gbp, bid_price_gbp, currency, message, created_at, updated_at').eq('bidder_driver_id', entityId).order('created_at', { ascending: false }).limit(50),
    driver.user_id
      ? supabaseAdmin.from('reviews').select('id, company_id, job_id, reviewer_user_id, reviewed_user_id, reviewer_company_id, rating, comment, would_use_again, delivered_promptly, courteous, created_at').eq('reviewed_user_id', driver.user_id).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    driver.user_id
      ? supabaseAdmin.from('notification_events').select('id, event_type, entity_type, entity_id, status, created_at, processed_at, attempt_count, last_error').eq('recipient_user_id', driver.user_id).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    driver.user_id
      ? supabaseAdmin.from('driver_load_alert_preferences').select('enabled, current_radius_enabled, home_outcode_enabled, home_outcode, future_position_enabled, radius_miles, current_location_max_age_minutes, require_vehicle_match, minimum_budget_gbp, in_app_enabled, email_enabled, push_enabled, updated_at').eq('driver_id', entityId).eq('user_id', driver.user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    countRows('vehicles', 'assigned_driver_id', entityId),
    countRows('jobs', 'assigned_driver_id', entityId),
    countRows('job_bids', 'bidder_driver_id', entityId),
    driver.user_id ? countRows('reviews', 'reviewed_user_id', driver.user_id) : Promise.resolve(0),
    countRows('driver_documents', 'driver_id', entityId),
  ]);

  for (const result of [vehicles, jobs, latestLocation, availabilityPresence, driverDocs, onboardingApps, bids, reviews, notifications]) {
    if (result.error) throw new Error(result.error.message);
  }
  if (loadAlertPreference.error && !['42P01', 'PGRST202', 'PGRST205'].includes(loadAlertPreference.error.code ?? '')) {
    throw new Error(loadAlertPreference.error.message);
  }

  const applicationIds = (onboardingApps.data ?? []).map((row) => row.id);
  const identityDocs = applicationIds.length
    ? await supabaseAdmin
      .from('driver_identity_documents')
      .select('id, onboarding_application_id, doc_type, upload_status, verification_status, reviewed_at, review_notes, expiry_date, issued_date, holder_name, document_number_last4, date_of_birth, risk_status, risk_reasons, created_at, updated_at')
      .in('onboarding_application_id', applicationIds)
      .order('created_at', { ascending: false })
      .limit(100)
    : { data: [], error: null };
  if (identityDocs.error) throw new Error(identityDocs.error.message);

  const authUser = authResult.data.user ?? null;
  const latestVehicle = (vehicles.data ?? [])[0] ?? null;
  const latestApplication = (onboardingApps.data ?? [])[0] ?? null;
  const latestExecutionAt = latestLocation.data?.recorded_at ? Date.parse(String(latestLocation.data.recorded_at)) : Number.NaN;
  const latestPresenceAt = availabilityPresence.data?.recorded_at
    ? Date.parse(String(availabilityPresence.data.recorded_at))
    : availabilityPresence.data?.updated_at
      ? Date.parse(String(availabilityPresence.data.updated_at))
      : Number.NaN;
  const positionNow = Date.now();
  const presenceFresh = isTimestampFresh(latestPresenceAt, positionNow);
  const presenceUsable = availabilityPresence.data?.exact_lat != null
    && availabilityPresence.data?.exact_lng != null
    && (!availabilityPresence.data.available_until || Date.parse(String(availabilityPresence.data.available_until)) > positionNow)
    && presenceFresh;
  const usePresence = presenceUsable && (!Number.isFinite(latestExecutionAt) || (Number.isFinite(latestPresenceAt) && latestPresenceAt >= latestExecutionAt));
  const mapLat = usePresence ? availabilityPresence.data?.exact_lat ?? null : latestLocation.data?.lat ?? null;
  const mapLng = usePresence ? availabilityPresence.data?.exact_lng ?? null : latestLocation.data?.lng ?? null;
  const mapRecordedAt = usePresence
    ? availabilityPresence.data?.recorded_at ?? availabilityPresence.data?.updated_at ?? null
    : latestLocation.data?.recorded_at ?? null;
  const mapSource = usePresence ? 'availability_presence' : latestLocation.data?.source ?? null;
  const locationAgeMinutes = mapRecordedAt ? Math.max(0, Math.round((Date.now() - Date.parse(String(mapRecordedAt))) / 60_000)) : null;
  const mapTimestamp = mapRecordedAt ? Date.parse(String(mapRecordedAt)) : Number.NaN;
  const locationFresh = isTimestampFresh(mapTimestamp, positionNow);
  const operationalStatus: 'online' | 'busy' | 'offline' | 'sold' =
    driver.is_active === false || String(driver.status ?? '').toLowerCase() === 'inactive' || String(driver.availability_status ?? '').toLowerCase() === 'offline' || (!locationFresh && !presenceUsable)
      ? 'offline'
      : String(driver.availability_status ?? '').toLowerCase() === 'busy'
        ? 'busy'
        : locationFresh || presenceUsable
          ? 'online'
          : 'offline';
  const ratings = (reviews.data ?? []).map((row) => Number(row.rating)).filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const averageRating = ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null;
  const openJobStatuses = new Set(['allocated', 'accepted', 'assigned', 'in_progress', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
  const activeJob = (jobs.data ?? []).find((job) => openJobStatuses.has(String(job.current_status ?? job.status ?? '').toLowerCase())) ?? null;
  const mapJob = activeJob ? {
    id: String(activeJob.id),
    short_id: String(activeJob.load_ref ?? activeJob.load_id ?? activeJob.id).slice(0, 12),
    client: company?.name ?? 'Platform job',
    status: String(activeJob.current_status ?? activeJob.status ?? 'unknown'),
    pickup: String(activeJob.pickup_location ?? activeJob.pickup_postcode ?? 'Pickup'),
    delivery: String(activeJob.delivery_location ?? activeJob.delivery_postcode ?? 'Delivery'),
    eta: null,
    map: {
      pickup_lat: activeJob.pickup_lat == null ? null : Number(activeJob.pickup_lat),
      pickup_lng: activeJob.pickup_lng == null ? null : Number(activeJob.pickup_lng),
      delivery_lat: activeJob.delivery_lat == null ? null : Number(activeJob.delivery_lat),
      delivery_lng: activeJob.delivery_lng == null ? null : Number(activeJob.delivery_lng),
    },
  } : null;
  const vehicleRegistration = latestVehicle?.registration ?? latestVehicle?.reg_plate ?? latestVehicle?.reg ?? driver.reg_number ?? '—';
  const vehicleLabel = latestVehicle
    ? [latestVehicle.make, latestVehicle.model].filter(Boolean).join(' ') || latestVehicle.vehicle_type || latestVehicle.type || 'Vehicle'
    : driver.vehicle_type ?? 'Vehicle';

  return {
    available: true, entityType: 'driver', entityId, stableId: entityId,
    reference: value(driver.reg_number ?? driver.license_number ?? driver.id),
    title: value(driver.display_name ?? driver.full_name ?? driver.name, 'Driver'),
    subtitle: [driver.email, company?.name, driver.driver_type].filter(Boolean).join(' · '),
    status: optional(driver.status),
    liveMap: {
      drivers: [{
        id: entityId,
        name: value(driver.display_name ?? driver.full_name ?? driver.name, 'Driver'),
        status: operationalStatus,
        vehicle: latestVehicle ? { registration: String(vehicleRegistration), label: String(vehicleLabel) } : null,
        location: mapLat != null && mapLng != null ? {
          lat: Number(mapLat),
          lng: Number(mapLng),
          heading: usePresence ? null : latestLocation.data?.heading == null ? null : Number(latestLocation.data.heading),
          speed_mph: usePresence ? null : latestLocation.data?.speed_mph == null ? null : Number(latestLocation.data.speed_mph),
          recorded_at: mapRecordedAt == null ? null : String(mapRecordedAt),
          source: mapSource == null ? null : String(mapSource),
        } : null,
      }],
      jobs: mapJob ? [mapJob] : [],
      routes: mapJob && mapJob.map.pickup_lat != null && mapJob.map.pickup_lng != null && mapJob.map.delivery_lat != null && mapJob.map.delivery_lng != null ? [mapJob] : [],
      note: mapLat != null && mapLng != null
        ? locationFresh || presenceUsable
          ? 'Fresh Platform Owner location derived from current execution tracking or active availability presence.'
          : 'Tracking is stale. This pin is the last known exact location and is not presented as live.'
        : 'No exact location is available for this driver.',
    },
    sections: [
      { id: 'identity', title: 'Driver identity & contact', fields: [
        field('display_name', 'Display name', driver.display_name),
        field('full_name', 'Full name', driver.full_name ?? driver.name),
        field('email', 'Email', driver.email ?? authUser?.email),
        field('phone', 'Phone', driver.phone),
        field('licence', 'Licence', driver.license_number),
        field('driver_type', 'Driver type', driver.driver_type),
        field('company', 'Company', company?.name),
        field('user_id', 'User ID', driver.user_id),
        field('created_at', 'Driver created', driver.created_at),
        field('updated_at', 'Last record update', driver.updated_at),
      ] },
      { id: 'access', title: 'Account & access', fields: [
        field('status', 'Driver status', driver.status),
        field('is_active', 'Active flag', driver.is_active),
        field('app_access', 'App access', driver.app_access),
        field('must_change_password', 'Must change password', driver.must_change_password),
        field('profile_status', 'Profile status', profile?.status),
        field('profile_role', 'Profile role', profile?.role),
        field('auth_email', 'Auth email', authUser?.email),
        field('auth_created', 'Auth account created', authUser?.created_at),
        field('last_sign_in', 'Last auth sign-in', authUser?.last_sign_in_at),
        field('last_app_login', 'Last app login', driver.last_app_login),
      ] },
      { id: 'readiness', title: 'Operational readiness & permissions', fields: [
        field('availability', 'Availability', driver.availability_status),
        field('commercial_bid', 'Commercial bid allowed', driver.can_commercial_bid),
        field('international', 'International approved', driver.international_work_approved),
        field('destination_priority', 'Destination priority', driver.destination_priority_enabled),
        field('destination_radius', 'Destination radius miles', driver.destination_radius_miles),
        field('future_position', 'Future position', driver.future_position),
        field('future_position_date', 'Future position from', driver.future_position_date),
        field('future_position_until', 'Future position until', driver.future_position_until),
        field('future_notes', 'Future availability notes', driver.future_availability_notes),
        field('notes', 'Internal driver notes', driver.notes),
      ] },
      { id: 'live-position', title: 'Live position & telemetry', fields: [
        field('operational_status', 'Derived live state', operationalStatus),
        field('location_age', 'Location age minutes', locationAgeMinutes),
        field('location_source', 'Location source', mapSource),
        field('recorded_at', 'Last position recorded', mapRecordedAt),
        field('lat', 'Latitude', mapLat),
        field('lng', 'Longitude', mapLng),
        field('speed', 'Speed mph', usePresence ? null : latestLocation.data?.speed_mph),
        field('heading', 'Heading', usePresence ? null : latestLocation.data?.heading),
        field('provider', 'Tracking provider', usePresence ? 'availability_presence' : latestLocation.data?.source_provider),
        field('presence_visibility', 'Availability visibility', availabilityPresence.data?.visibility),
        field('available_until', 'Available until', availabilityPresence.data?.available_until),
      ], unavailable: mapLat == null || mapLng == null, unavailableReason: mapLat == null || mapLng == null ? 'No exact driver location is currently available.' : undefined },
      { id: 'vehicle', title: 'Current vehicle context', fields: [
        field('registration', 'Registration', vehicleRegistration),
        field('vehicle', 'Vehicle', vehicleLabel),
        field('vehicle_status', 'Vehicle status', latestVehicle?.current_status ?? latestVehicle?.status),
        field('available', 'Vehicle available', latestVehicle?.is_available),
        field('tracked', 'Vehicle tracked', latestVehicle?.is_tracked),
        field('last_tracked', 'Vehicle last tracked', latestVehicle?.last_tracked_at),
        field('telematics', 'Telematics ID', latestVehicle?.telematics_id),
        field('payload', 'Payload kg', latestVehicle?.payload_kg),
        field('pallets', 'Pallet capacity', latestVehicle?.pallets_capacity),
        field('tail_lift', 'Tail lift', latestVehicle?.has_tail_lift),
        field('equipment', 'Equipment', latestVehicle?.equipment),
      ], unavailable: !latestVehicle, unavailableReason: !latestVehicle ? 'No vehicle is currently assigned to this driver.' : undefined },
      { id: 'compliance', title: 'Driver compliance', fields: [
        field('driver_documents', 'Driver documents', documentCount),
        field('identity_documents', 'Identity documents loaded', (identityDocs.data ?? []).length),
        field('onboarding_status', 'Latest onboarding status', latestApplication?.status),
        field('onboarding_step', 'Latest onboarding step', latestApplication?.current_step),
        field('onboarding_completion', 'Onboarding completion %', latestApplication?.completion_percentage),
        field('onboarding_risk', 'Onboarding risk', latestApplication?.risk_status),
        field('onboarding_risk_reason', 'Onboarding risk reason', latestApplication?.risk_reason),
      ] },
      { id: 'driver-documents', title: 'Driver document register', description: 'Recent driver compliance documents with status, expiry, verification and risk context.', fields: (driverDocs.data ?? []).map((doc, index) =>
        field(
          String(doc.id ?? index),
          `${doc.doc_type ?? 'Document'} · ${doc.status ?? 'unknown'}`,
          [
            doc.holder_name ? `holder ${doc.holder_name}` : null,
            doc.document_number_last4 ? `last4 ${doc.document_number_last4}` : null,
            doc.date_of_birth ? `DOB ${doc.date_of_birth}` : null,
            doc.issued_date ? `issued ${doc.issued_date}` : null,
            doc.expiry_date ? `expires ${doc.expiry_date}` : null,
            doc.risk_status ? `risk ${doc.risk_status}` : null,
            doc.rejection_reason ? `reason ${doc.rejection_reason}` : null,
            doc.verified_at ? `verified ${doc.verified_at}` : null,
          ].filter(Boolean).join(' · '),
        ),
      ), unavailable: (driverDocs.data ?? []).length === 0, unavailableReason: (driverDocs.data ?? []).length === 0 ? 'No driver compliance documents are stored.' : undefined },
      { id: 'identity-documents', title: 'Identity document register', description: 'Identity documents linked through the driver’s onboarding applications.', fields: (identityDocs.data ?? []).map((doc, index) =>
        field(
          String(doc.id ?? index),
          `${doc.doc_type ?? 'Identity document'} · ${doc.verification_status ?? doc.upload_status ?? 'unknown'}`,
          [
            doc.holder_name ? `holder ${doc.holder_name}` : null,
            doc.document_number_last4 ? `last4 ${doc.document_number_last4}` : null,
            doc.date_of_birth ? `DOB ${doc.date_of_birth}` : null,
            doc.issued_date ? `issued ${doc.issued_date}` : null,
            doc.expiry_date ? `expires ${doc.expiry_date}` : null,
            doc.risk_status ? `risk ${doc.risk_status}` : null,
            doc.review_notes ? `review ${doc.review_notes}` : null,
            doc.reviewed_at ? `reviewed ${doc.reviewed_at}` : null,
          ].filter(Boolean).join(' · '),
        ),
      ), unavailable: (identityDocs.data ?? []).length === 0, unavailableReason: (identityDocs.data ?? []).length === 0 ? 'No onboarding identity documents are linked to this driver.' : undefined },
      { id: 'onboarding-history', title: 'Onboarding history', fields: (onboardingApps.data ?? []).map((application, index) =>
        field(
          String(application.id ?? index),
          `Application ${index + 1} · ${application.status ?? 'unknown'}`,
          [
            application.current_step ? `step ${application.current_step}` : null,
            application.completion_percentage != null ? `${application.completion_percentage}% complete` : null,
            application.risk_status ? `risk ${application.risk_status}` : null,
            application.risk_reason ? `reason ${application.risk_reason}` : null,
            application.submitted_at ? `submitted ${application.submitted_at}` : null,
            application.reviewed_at ? `reviewed ${application.reviewed_at}` : null,
            application.last_activity_at ? `activity ${application.last_activity_at}` : null,
          ].filter(Boolean).join(' · '),
        ),
      ), unavailable: (onboardingApps.data ?? []).length === 0, unavailableReason: (onboardingApps.data ?? []).length === 0 ? 'No onboarding application is linked to this driver account.' : undefined },
      { id: 'reputation', title: 'Reputation & commercial history', fields: [
        field('reviews', 'Reviews', reviewCount),
        field('rating', 'Average rating', averageRating),
        field('bids', 'Marketplace bids', bidCount),
        field('assigned_jobs', 'Assigned jobs', jobCount),
        field('assigned_vehicles', 'Assigned vehicles', vehicleCount),
      ] },
      { id: 'notifications', title: 'Recent driver notifications', description: 'Recent platform notification events addressed to this driver account.', fields: (notifications.data ?? []).map((event, index) =>
        field(
          String(event.id ?? index),
          `${event.event_type ?? 'Notification'} · ${event.status ?? 'unknown'}`,
          [
            event.entity_type ? `entity ${event.entity_type}` : null,
            event.created_at ? `created ${event.created_at}` : null,
            event.processed_at ? `processed ${event.processed_at}` : null,
            event.attempt_count != null ? `attempts ${event.attempt_count}` : null,
            event.last_error ? `error ${event.last_error}` : null,
          ].filter(Boolean).join(' · '),
        ),
      ), unavailable: (notifications.data ?? []).length === 0, unavailableReason: (notifications.data ?? []).length === 0 ? 'No recent notification events are stored for this driver user.' : undefined },
      { id: 'alerts', title: 'Load alerts & notification preferences', fields: loadAlertPreference.data ? [
        field('enabled', 'Load alerts enabled', loadAlertPreference.data.enabled),
        field('radius', 'Radius miles', loadAlertPreference.data.radius_miles),
        field('current_radius', 'Current radius enabled', loadAlertPreference.data.current_radius_enabled),
        field('home_outcode', 'Home outcode', loadAlertPreference.data.home_outcode),
        field('future_position_enabled', 'Future position matching', loadAlertPreference.data.future_position_enabled),
        field('vehicle_match', 'Require vehicle match', loadAlertPreference.data.require_vehicle_match),
        field('minimum_budget', 'Minimum budget GBP', loadAlertPreference.data.minimum_budget_gbp),
        field('in_app', 'In-app notifications', loadAlertPreference.data.in_app_enabled),
        field('email_notifications', 'Email notifications', loadAlertPreference.data.email_enabled),
        field('push_notifications', 'Push notifications', loadAlertPreference.data.push_enabled),
        field('updated', 'Preferences updated', loadAlertPreference.data.updated_at),
      ] : [], unavailable: !loadAlertPreference.data, unavailableReason: !loadAlertPreference.data ? 'No driver load-alert preference record is stored.' : undefined },
    ],
    relationshipGroups: [
      { id: 'company', title: 'Company', rows: company ? compactRelations([relation('company', company.id, company.trading_name ?? company.name ?? company.legal_name ?? 'Company', company.xd_id ?? company.company_number, company.status)]) : [] },
      { id: 'user', title: 'Application user', rows: profile ? compactRelations([relation('user', profile.user_id, profile.full_name ?? 'User', profile.xd_id, profile.status)]) : [] },
      { id: 'vehicles', title: 'Assigned vehicles', total: vehicleCount, rows: compactRelations((vehicles.data ?? []).map((row) => relation('vehicle', row.id, [row.make, row.model].filter(Boolean).join(' ') || row.vehicle_type || row.type || 'Vehicle', row.registration ?? row.reg_plate ?? row.reg, row.status ?? row.current_status))) },
      { id: 'jobs', title: 'Recent assigned jobs', total: jobCount, rows: compactRelations((jobs.data ?? []).map((row) => relation('job', row.id, row.title ?? `${row.pickup_location ?? 'Pickup'} → ${row.delivery_location ?? 'Delivery'}`, row.load_ref ?? row.load_id, row.current_status ?? row.status))) },
      { id: 'bids', title: 'Marketplace bids', total: bidCount, rows: compactRelations((bids.data ?? []).map((row) => relation('job', row.job_id, `Bid · ${row.amount_gbp ?? row.bid_price_gbp ?? '—'} ${row.currency ?? 'GBP'}`, row.id, row.status))) },
      { id: 'reviews', title: 'Recent reviews', total: reviewCount, rows: compactRelations((reviews.data ?? []).map((row) => relation('job', row.job_id, `Review ${row.rating ?? '—'}/5 · ${row.comment ?? 'No comment'}`, row.id))) },
      { id: 'live-job', title: 'Currently tracked / active job', rows: activeJob ? compactRelations([relation('job', activeJob.id, activeJob.title ?? `${activeJob.pickup_location ?? 'Pickup'} → ${activeJob.delivery_location ?? 'Delivery'}`, activeJob.load_ref ?? activeJob.load_id, activeJob.current_status ?? activeJob.status)]) : [] },
    ],
    note: `Loaded ${driverDocs.data?.length ?? 0} driver documents, ${identityDocs.data?.length ?? 0} identity documents, ${bids.data?.length ?? 0} bids, ${reviews.data?.length ?? 0} reviews and ${notifications.data?.length ?? 0} recent notifications. Relation lists are recent snapshots; exact counts are shown where available.`,
  };
}

async function inspectVehicle(entityId: string): Promise<InspectorPayload | null> {
  if (!supabaseAdmin) return null;
  const { data: vehicle, error } = await supabaseAdmin.from('vehicles').select('id, company_id, assigned_driver_id, reg, registration, reg_plate, vehicle_reference, internal_reference, vin, make, model, year, manufacture_year, vehicle_type, type, body_type, status, current_status, is_available, is_tracked, current_location, last_tracked_at, telematics_id, capacity_kg, max_weight_kg, pallets_capacity, internal_length_m, internal_width_m, internal_height_m, has_tail_lift, has_hiab, has_trailer, equipment, international_work_approved, created_at, updated_at').eq('id', entityId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!vehicle) return null;
  const [company, driver, jobs, location, jobCount] = await Promise.all([
    companySummary(vehicle.company_id),
    vehicle.assigned_driver_id ? supabaseAdmin.from('drivers').select('id, display_name, full_name, name, reg_number, status').eq('id', vehicle.assigned_driver_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status, pickup_location, delivery_location').eq('vehicle_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('driver_locations').select('id, driver_id, job_id, lat, lng, speed_mph, heading, source, source_provider, recorded_at').eq('vehicle_id', entityId).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    countRows('jobs', 'vehicle_id', entityId),
  ]);
  for (const result of [driver, jobs, location]) if (result.error) throw new Error(result.error.message);
  const registration = vehicle.registration ?? vehicle.reg_plate ?? vehicle.reg ?? vehicle.vehicle_reference ?? vehicle.id;
  return {
    available: true, entityType: 'vehicle', entityId, stableId: entityId, reference: value(registration),
    title: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || value(vehicle.vehicle_type ?? vehicle.type, 'Vehicle'),
    subtitle: [company?.name, vehicle.vehicle_reference, vehicle.internal_reference].filter(Boolean).join(' · '), status: optional(vehicle.status ?? vehicle.current_status),
    sections: [
      { id: 'identity', title: 'Vehicle identity', fields: [field('registration', 'Registration', registration), field('vehicle_reference', 'Vehicle reference', vehicle.vehicle_reference), field('internal_reference', 'Internal reference', vehicle.internal_reference), field('vin', 'VIN', vehicle.vin), field('make', 'Make', vehicle.make), field('model', 'Model', vehicle.model), field('year', 'Year', vehicle.manufacture_year ?? vehicle.year), field('body_type', 'Body type', vehicle.body_type)] },
      { id: 'capability', title: 'Capacity and equipment', fields: [field('vehicle_type', 'Vehicle type', vehicle.vehicle_type ?? vehicle.type), field('capacity', 'Capacity kg', vehicle.capacity_kg ?? vehicle.max_weight_kg), field('pallets', 'Pallet capacity', vehicle.pallets_capacity), field('dimensions', 'Internal dimensions', [vehicle.internal_length_m, vehicle.internal_width_m, vehicle.internal_height_m].filter((v) => v != null).join(' × ')), field('tail_lift', 'Tail lift', vehicle.has_tail_lift), field('hiab', 'HIAB', vehicle.has_hiab), field('trailer', 'Trailer', vehicle.has_trailer), field('equipment', 'Equipment', vehicle.equipment)] },
      { id: 'tracking', title: 'Tracking state', fields: [field('tracked', 'Tracked', vehicle.is_tracked), field('available', 'Available', vehicle.is_available), field('current_location', 'Current location', vehicle.current_location), field('last_tracked', 'Last tracked', vehicle.last_tracked_at), field('telematics_id', 'Telematics ID', vehicle.telematics_id), field('international', 'International approved', vehicle.international_work_approved)] },
      { id: 'latest-location', title: 'Latest telemetry', fields: location.data ? [field('recorded_at', 'Recorded', location.data.recorded_at), field('lat', 'Latitude', location.data.lat), field('lng', 'Longitude', location.data.lng), field('speed', 'Speed mph', location.data.speed_mph), field('source', 'Source', location.data.source), field('provider', 'Provider', location.data.source_provider)] : [], unavailable: !location.data, unavailableReason: !location.data ? 'No vehicle-linked telemetry has been recorded.' : undefined },
    ],
    relationshipGroups: [
      { id: 'company', title: 'Company', rows: company ? compactRelations([relation('company', company.id, company.trading_name ?? company.name ?? company.legal_name ?? 'Company', company.xd_id ?? company.company_number, company.status)]) : [] },
      { id: 'driver', title: 'Assigned driver', rows: driver.data ? compactRelations([relation('driver', driver.data.id, driver.data.display_name ?? driver.data.full_name ?? driver.data.name ?? 'Driver', driver.data.reg_number, driver.data.status)]) : [] },
      { id: 'jobs', title: 'Recent jobs', total: jobCount, rows: compactRelations((jobs.data ?? []).map((row) => relation('job', row.id, row.title ?? `${row.pickup_location ?? 'Pickup'} → ${row.delivery_location ?? 'Delivery'}`, row.load_ref ?? row.load_id, row.status))) },
      { id: 'tracked-job', title: 'Latest tracked job', rows: location.data?.job_id ? compactRelations([relation('job', location.data.job_id, 'Tracked job')]) : [] },
    ],
  };
}

async function inspectJob(entityId: string): Promise<InspectorPayload | null> {
  if (!supabaseAdmin) return null;
  const { data: job, error } = await supabaseAdmin.from('jobs').select('id, company_id, posted_by_company_id, awarded_carrier_company_id, assigned_driver_id, vehicle_id, accepted_bid_id, title, description, status, current_status, load_id, load_ref, load_reference, booking_reference, your_ref, cust_ref, customer_ref, customer_reference, pickup_location, pickup_address_line1, pickup_city, pickup_postcode, pickup_datetime, delivery_location, delivery_address_line1, delivery_city, delivery_postcode, delivery_datetime, requested_vehicle_type, requested_vehicle_label, vehicle_type, cargo_type, requested_cargo_label, pallets, weight_kg, cargo_value_gbp, special_requirements, document_checklist, hard_copy_pod, agreed_rate, agreed_rate_gbp, currency, payment_terms, exchange_visibility, direct_delivery_required, pod_required, pod_generated, pod_generated_at, delivery_photos, pod_photos, delivery_signature_data, client_signature_name, delivery_notes, collection_notes, cancellation_reason, created_by, created_at, updated_at, status_updated_at, delivered_at, completed_at').eq('id', entityId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) return null;
  const [postingCompany, postedByCompany, awardedCompany, driver, vehicle, bids, invoices, disputes, events, notifications, jobDocuments, latestTracking, bidCount, invoiceCount, disputeCount] = await Promise.all([
    companySummary(job.company_id), companySummary(job.posted_by_company_id), companySummary(job.awarded_carrier_company_id),
    job.assigned_driver_id ? supabaseAdmin.from('drivers').select('id, display_name, full_name, name, status, company_id, reg_number').eq('id', job.assigned_driver_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    job.vehicle_id ? supabaseAdmin.from('vehicles').select('id, reg, registration, reg_plate, make, model, status, current_status').eq('id', job.vehicle_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from('job_bids').select('id, bidder_company_id, bidder_driver_id, quote_vehicle_id, status, amount, amount_gbp, bid_price_gbp, currency, created_at').eq('job_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('invoices').select('id, invoice_number, status, payment_status, amount, currency, created_at').eq('job_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('job_disputes').select('id, status, description, raised_by_company_id, created_at, resolved_at').eq('job_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('job_events').select('id, event_type, message, created_by, company_id, created_at').eq('job_id', entityId).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('notification_events').select('id, event_type, status, recipient_user_id, created_at, processed_at, last_error').eq('entity_type', 'job').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('job_documents').select('id, job_id, doc_type, created_at').eq('job_id', entityId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('driver_locations').select('job_id, recorded_at').eq('job_id', entityId).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    countRows('job_bids', 'job_id', entityId), countRows('invoices', 'job_id', entityId), countRows('job_disputes', 'job_id', entityId),
  ]);
  for (const result of [driver, vehicle, bids, invoices, disputes, events, notifications]) if (result.error) throw new Error(result.error.message);
  const reference = job.load_ref ?? job.load_id ?? job.load_reference ?? job.booking_reference ?? job.your_ref ?? job.id;
  const podPhotoCount = Array.isArray(job.pod_photos) ? job.pod_photos.length : 0;
  const deliveryPhotoCount = Array.isArray(job.delivery_photos) ? job.delivery_photos.length : 0;
  const podEvidence = Boolean(job.pod_generated || job.delivery_signature_data || podPhotoCount || deliveryPhotoCount || job.hard_copy_pod);

  let secureEligibility: Awaited<ReturnType<typeof resolveDriverOperationalEligibility>> | null = null;
  let secureEligibilityUnavailable = false;
  if (job.assigned_driver_id) {
    try { secureEligibility = await resolveDriverOperationalEligibility(supabaseAdmin, String(job.assigned_driver_id)); }
    catch { secureEligibilityUnavailable = true; }
  }
  const secureEvidenceUnavailable = Boolean(jobDocuments.error || latestTracking.error);
  const secureIntelligence = secureEvidenceUnavailable ? null : deriveSecureLoadIntelligence(
    job, secureEligibility, secureEligibilityUnavailable, Boolean(latestTracking.data), (jobDocuments.data ?? []).length,
  );
  const secureUnavailableReason = [
    jobDocuments.error ? 'Job document evidence is unavailable.' : null,
    latestTracking.error ? 'Tracking evidence is unavailable.' : null,
  ].filter(Boolean).join(' ');
  const secureStateTone: FieldTone = secureIntelligence?.state === 'blocked' ? 'danger' : secureIntelligence?.state === 'review' ? 'warning' : secureIntelligence?.state === 'clear' ? 'success' : 'muted';
  const secureCredentialTone: FieldTone = secureIntelligence?.credentialState === 'blocked' || secureIntelligence?.credentialState === 'unavailable' ? 'danger' : secureIntelligence?.credentialState === 'verified' ? 'success' : 'muted';

  const bidRelations: InspectorRelation[] = [];
  for (const bid of bids.data ?? []) {
    if (bid.bidder_company_id) bidRelations.push({ entityType: 'company', entityId: String(bid.bidder_company_id), label: `Bidder company · ${value(bid.amount_gbp ?? bid.amount ?? bid.bid_price_gbp)}`, reference: optional(bid.id), status: optional(bid.status) });
    if (bid.bidder_driver_id) bidRelations.push({ entityType: 'driver', entityId: String(bid.bidder_driver_id), label: 'Bidder driver', reference: optional(bid.id), status: optional(bid.status) });
    if (bid.quote_vehicle_id) bidRelations.push({ entityType: 'vehicle', entityId: String(bid.quote_vehicle_id), label: 'Quoted vehicle', reference: optional(bid.id), status: optional(bid.status) });
  }

  return {
    available: true, entityType: 'job', entityId, stableId: entityId, reference: value(reference),
    title: value(job.title, `${value(job.pickup_location, 'Pickup')} → ${value(job.delivery_location, 'Delivery')}`),
    subtitle: `${value(job.pickup_location, 'Pickup')} → ${value(job.delivery_location, 'Delivery')}`, status: optional(job.current_status ?? job.status),
    sections: [
      { id: 'commercial', title: 'Commercial identity', fields: [field('reference', 'Job reference', reference), field('your_ref', 'Your ref', job.your_ref), field('customer_ref', 'Customer ref', job.customer_ref ?? job.customer_reference ?? job.cust_ref), field('booking_reference', 'Booking reference', job.booking_reference), field('posting_company', 'Posting company', postingCompany?.name ?? postedByCompany?.name), field('awarded_company', 'Awarded carrier', awardedCompany?.name), field('agreed_rate', 'Agreed rate', job.agreed_rate_gbp ?? job.agreed_rate), field('currency', 'Currency', job.currency), field('payment_terms', 'Payment terms', job.payment_terms)] },
      { id: 'route', title: 'Route and execution window', fields: [field('pickup', 'Pickup', job.pickup_location), field('pickup_postcode', 'Pickup postcode', job.pickup_postcode), field('pickup_datetime', 'Pickup datetime', job.pickup_datetime), field('delivery', 'Delivery', job.delivery_location), field('delivery_postcode', 'Delivery postcode', job.delivery_postcode), field('delivery_datetime', 'Delivery datetime', job.delivery_datetime), field('direct_delivery', 'Direct delivery', job.direct_delivery_required)] },
      { id: 'load', title: 'Load and vehicle requirement', fields: [field('vehicle', 'Requested vehicle', job.requested_vehicle_label ?? job.requested_vehicle_type ?? job.vehicle_type), field('cargo', 'Cargo', job.requested_cargo_label ?? job.cargo_type), field('pallets', 'Pallets', job.pallets), field('weight', 'Weight kg', job.weight_kg), field('exchange_visibility', 'Exchange visibility', job.exchange_visibility)] },
      { id: 'lifecycle', title: 'Lifecycle', fields: [field('status', 'Status', job.current_status ?? job.status), field('status_updated', 'Status updated', job.status_updated_at), field('delivered_at', 'Delivered', job.delivered_at), field('completed_at', 'Completed', job.completed_at), field('cancel_reason', 'Cancellation reason', job.cancellation_reason), field('updated_at', 'Updated', job.updated_at)] },
      { id: 'secure-load', title: 'Secure Load / Security', description: 'Read-only, fail-closed execution and evidence intelligence derived from canonical job, driver, vehicle, compliance, document, tracking and POD facts.', fields: secureIntelligence ? [field('secure_state', 'Secure state', secureIntelligence.state, secureStateTone), field('credential_state', 'Credential state', secureIntelligence.credentialState, secureCredentialTone), field('blockers', 'Blockers', secureIntelligence.blockers.length ? secureIntelligence.blockers.join(', ') : 'None', secureIntelligence.blockers.length ? 'danger' : 'success'), field('review_signals', 'Review signals', secureIntelligence.reviewSignals.length ? secureIntelligence.reviewSignals.join(', ') : 'None'), field('cargo_value', 'Cargo value GBP', secureIntelligence.cargoValueGbp), field('high_value', 'High Value Goods', secureIntelligence.highValueGoods), field('direct_delivery', 'Direct delivery', secureIntelligence.directDeliveryRequired), field('requested_documents', 'Requested documents', secureIntelligence.requestedDocuments), field('uploaded_documents', 'Uploaded documents', secureIntelligence.uploadedJobDocuments), field('tracking', 'Tracking evidence present', secureIntelligence.trackingEvidencePresent), field('tracking_recorded', 'Latest tracking', latestTracking.data?.recorded_at), field('pod_required', 'POD required', secureIntelligence.podRequired), field('pod_evidence', 'POD evidence present', secureIntelligence.podEvidencePresent), field('job_vehicle', 'Job vehicle ID', job.vehicle_id), field('canonical_vehicle', 'Canonical driver vehicle ID', secureIntelligence.canonicalVehicleId), field('eligibility_checks', 'Execution eligibility checks', secureIntelligence.eligibilityChecks)] : [], unavailable: !secureIntelligence, unavailableReason: !secureIntelligence ? (secureUnavailableReason || 'Secure Load evidence could not be determined safely.') : undefined },
      { id: 'pod', title: 'Proof of delivery', fields: [field('required', 'POD required', job.pod_required), field('generated', 'POD generated', job.pod_generated), field('generated_at', 'Generated at', job.pod_generated_at), field('signature', 'Signature present', Boolean(job.delivery_signature_data)), field('signatory', 'Signatory', job.client_signature_name), field('pod_photos', 'POD photos', podPhotoCount), field('delivery_photos', 'Delivery photos', deliveryPhotoCount), field('evidence', 'Evidence state', podEvidence ? 'Evidence present' : 'No evidence')], unavailable: !podEvidence && !job.pod_required, unavailableReason: !podEvidence && !job.pod_required ? 'POD is not currently required and no delivery evidence is present.' : undefined },
      { id: 'activity', title: 'Activity volumes', fields: [field('bids', 'Bids', bidCount), field('invoices', 'Invoices', invoiceCount), field('disputes', 'Disputes', disputeCount), field('events', 'Recent events loaded', (events.data ?? []).length), field('notifications', 'Recent notifications loaded', (notifications.data ?? []).length)] },
    ],
    relationshipGroups: [
      { id: 'companies', title: 'Commercial companies', rows: compactRelations([relation('company', postingCompany?.id, postingCompany?.name ?? 'Posting company', postingCompany?.xd_id ?? postingCompany?.company_number, postingCompany?.status), relation('company', awardedCompany?.id, awardedCompany?.name ?? 'Awarded carrier', awardedCompany?.xd_id ?? awardedCompany?.company_number, awardedCompany?.status)]) },
      { id: 'driver', title: 'Executing driver', rows: driver.data ? compactRelations([relation('driver', driver.data.id, driver.data.display_name ?? driver.data.full_name ?? driver.data.name ?? 'Driver', driver.data.reg_number, driver.data.status)]) : [] },
      { id: 'vehicle', title: 'Executing vehicle', rows: vehicle.data ? compactRelations([relation('vehicle', vehicle.data.id, [vehicle.data.make, vehicle.data.model].filter(Boolean).join(' ') || 'Vehicle', vehicle.data.registration ?? vehicle.data.reg_plate ?? vehicle.data.reg, vehicle.data.status ?? vehicle.data.current_status)]) : [] },
      { id: 'bids', title: 'Bid identities and quoted resources', total: bidCount, rows: bidRelations },
      { id: 'invoices', title: 'Invoices', total: invoiceCount, rows: compactRelations((invoices.data ?? []).map((row) => relation('invoice', row.id, row.invoice_number ?? 'Invoice', row.invoice_number, row.payment_status ?? row.status))) },
      { id: 'disputes', title: 'Job disputes', total: disputeCount, rows: compactRelations((disputes.data ?? []).map((row) => relation('dispute', row.id, row.description ?? 'Job dispute', row.id, row.status))) },
      { id: 'pod-link', title: 'Proof of delivery', rows: podEvidence || job.pod_required ? compactRelations([relation('pod', job.id, 'Job POD evidence', reference, podEvidence ? 'evidence_present' : 'required')]) : [] },
    ],
  };
}

async function inspectInvoice(entityId: string): Promise<InspectorPayload | null> {
  if (!supabaseAdmin) return null;
  const { data: invoice, error } = await supabaseAdmin.from('invoices').select('id, company_id, buyer_company_id, supplier_company_id, job_id, invoice_number, job_ref, customer_ref, load_id, status, payment_status, invoice_origin, client_name, client_email, bill_to_name, bill_to_email, currency, amount, net_amount, subtotal, vat_rate, vat_amount, total, invoice_date, issue_date, due_date, payment_terms, payment_due_days, submitted_at, approved_at, disputed_at, paid_at, pod_required, pod_generated, pod_generated_at, pod_photos, signature, recipient_name, delivery_state, delivery_provider, delivery_attempted_at, delivery_error, created_at, updated_at').eq('id', entityId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice) return null;
  const [issuer, buyer, supplier, job, disputes, payments, disputeCount, paymentCount] = await Promise.all([
    companySummary(invoice.company_id), companySummary(invoice.buyer_company_id), companySummary(invoice.supplier_company_id),
    invoice.job_id ? supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status, pickup_location, delivery_location').eq('id', invoice.job_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from('invoice_disputes').select('id, status, reason, details, company_id, buyer_company_id, supplier_company_id, job_id, created_at, resolved_at').eq('invoice_id', entityId).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('invoice_payment_history').select('id, amount, currency, settlement_method, external_reference, paid_at, created_at').eq('invoice_id', entityId).order('paid_at', { ascending: false }).limit(25),
    countRows('invoice_disputes', 'invoice_id', entityId), countRows('invoice_payment_history', 'invoice_id', entityId),
  ]);
  for (const result of [job, disputes, payments]) if (result.error) throw new Error(result.error.message);
  const podPhotos = Array.isArray(invoice.pod_photos) ? invoice.pod_photos.length : 0;
  return {
    available: true, entityType: 'invoice', entityId, stableId: entityId, reference: value(invoice.invoice_number ?? invoice.id),
    title: invoice.client_name ? `Invoice · ${invoice.client_name}` : 'Invoice', subtitle: [invoice.job_ref, issuer?.name, invoice.client_email].filter(Boolean).join(' · '), status: optional(invoice.payment_status ?? invoice.status),
    sections: [
      { id: 'identity', title: 'Invoice identity', fields: [field('invoice_number', 'Invoice number', invoice.invoice_number), field('job_ref', 'Job ref', invoice.job_ref), field('customer_ref', 'Customer ref', invoice.customer_ref), field('load_id', 'Load ID', invoice.load_id), field('origin', 'Origin', invoice.invoice_origin), field('client', 'Client', invoice.client_name ?? invoice.bill_to_name), field('client_email', 'Client email', invoice.client_email ?? invoice.bill_to_email)] },
      { id: 'money', title: 'Financial state', fields: [field('amount', 'Amount', invoice.amount ?? invoice.total), field('net', 'Net', invoice.net_amount ?? invoice.subtotal), field('vat_rate', 'VAT rate', invoice.vat_rate), field('vat_amount', 'VAT amount', invoice.vat_amount), field('currency', 'Currency', invoice.currency), field('status', 'Invoice status', invoice.status), field('payment_status', 'Payment status', invoice.payment_status)] },
      { id: 'timeline', title: 'Invoice timeline', fields: [field('invoice_date', 'Invoice date', invoice.invoice_date ?? invoice.issue_date), field('due_date', 'Due date', invoice.due_date), field('submitted', 'Submitted', invoice.submitted_at), field('approved', 'Approved', invoice.approved_at), field('disputed', 'Disputed', invoice.disputed_at), field('paid', 'Paid', invoice.paid_at), field('terms', 'Payment terms', invoice.payment_terms ?? invoice.payment_due_days)] },
      { id: 'pod', title: 'POD attachment state', fields: [field('required', 'POD required', invoice.pod_required), field('generated', 'POD generated', invoice.pod_generated), field('generated_at', 'POD generated at', invoice.pod_generated_at), field('photos', 'POD photos', podPhotos), field('signature', 'Signature present', Boolean(invoice.signature)), field('recipient', 'Recipient', invoice.recipient_name)] },
      { id: 'delivery', title: 'Invoice delivery state', fields: [field('state', 'Delivery state', invoice.delivery_state), field('provider', 'Provider', invoice.delivery_provider), field('attempted', 'Attempted', invoice.delivery_attempted_at), field('error', 'Delivery error', invoice.delivery_error)] },
    ],
    relationshipGroups: [
      { id: 'companies', title: 'Commercial parties', rows: compactRelations([relation('company', issuer?.id, `Issuer · ${issuer?.name ?? 'Company'}`, issuer?.xd_id ?? issuer?.company_number, issuer?.status), relation('company', buyer?.id, `Buyer · ${buyer?.name ?? 'Company'}`, buyer?.xd_id ?? buyer?.company_number, buyer?.status), relation('company', supplier?.id, `Supplier · ${supplier?.name ?? 'Company'}`, supplier?.xd_id ?? supplier?.company_number, supplier?.status)]) },
      { id: 'job', title: 'Underlying job', rows: job.data ? compactRelations([relation('job', job.data.id, job.data.title ?? `${job.data.pickup_location ?? 'Pickup'} → ${job.data.delivery_location ?? 'Delivery'}`, job.data.load_ref ?? job.data.load_id, job.data.status)]) : [] },
      { id: 'disputes', title: 'Invoice disputes', total: disputeCount, rows: compactRelations((disputes.data ?? []).map((row) => row.job_id ? relation('job', row.job_id, `Invoice dispute · ${row.reason ?? row.status}`, row.id, row.status) : null)) },
      { id: 'payments', title: 'Payment history', total: paymentCount, rows: [] },
      { id: 'pod', title: 'Related POD', rows: invoice.job_id && (invoice.pod_required || invoice.pod_generated || podPhotos || invoice.signature) ? compactRelations([relation('pod', invoice.job_id, 'Underlying job POD', invoice.job_ref, invoice.pod_generated ? 'generated' : 'evidence')]) : [] },
    ],
  };
}

async function inspectTicket(entityId: string): Promise<InspectorPayload | null> {
  if (!supabaseAdmin) return null;
  const { data: ticket, error } = await supabaseAdmin.from('support_tickets').select('id, company_id, raised_by_user_id, subject, description, category, priority, status, assigned_to_user_id, resolution_note, resolved_at, closed_at, created_at, updated_at').eq('id', entityId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ticket) return null;
  const [company, raisedBy, assignedTo] = await Promise.all([companySummary(ticket.company_id), profileSummary(ticket.raised_by_user_id), profileSummary(ticket.assigned_to_user_id)]);
  return {
    available: true, entityType: 'ticket', entityId, stableId: entityId, reference: entityId, title: value(ticket.subject, 'Support ticket'),
    subtitle: [ticket.category, company?.name].filter(Boolean).join(' · '), status: optional(ticket.status),
    sections: [
      { id: 'ticket', title: 'Ticket context', fields: [field('category', 'Category', ticket.category), field('priority', 'Priority', ticket.priority), field('status', 'Status', ticket.status), field('description', 'Description', ticket.description), field('created', 'Created', ticket.created_at), field('updated', 'Updated', ticket.updated_at)] },
      { id: 'resolution', title: 'Resolution', fields: [field('resolution_note', 'Resolution note', ticket.resolution_note), field('resolved_at', 'Resolved', ticket.resolved_at), field('closed_at', 'Closed', ticket.closed_at)] },
    ],
    relationshipGroups: [
      { id: 'company', title: 'Company', rows: company ? compactRelations([relation('company', company.id, company.name ?? 'Company', company.xd_id ?? company.company_number, company.status)]) : [] },
      { id: 'users', title: 'People', rows: compactRelations([relation('user', raisedBy?.user_id, `Raised by · ${raisedBy?.full_name ?? 'User'}`, raisedBy?.xd_id, raisedBy?.status), relation('user', assignedTo?.user_id, `Assigned to · ${assignedTo?.full_name ?? 'User'}`, assignedTo?.xd_id, assignedTo?.status)]) },
    ],
  };
}

async function inspectDispute(entityId: string): Promise<InspectorPayload | null> {
  if (!supabaseAdmin) return null;
  const jobResult = await supabaseAdmin.from('job_disputes').select('id, job_id, raised_by_company_id, status, description, resolved_by, resolved_at, resolution_note, created_at, updated_at').eq('id', entityId).maybeSingle();
  if (jobResult.error) throw new Error(jobResult.error.message);
  if (jobResult.data) {
    const dispute = jobResult.data;
    const [company, resolver, job] = await Promise.all([
      companySummary(dispute.raised_by_company_id), profileSummary(dispute.resolved_by),
      dispute.job_id ? supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status, pickup_location, delivery_location').eq('id', dispute.job_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (job.error) throw new Error(job.error.message);
    return {
      available: true, entityType: 'dispute', entityId, stableId: entityId, reference: entityId,
      title: value(dispute.description, 'Job dispute').slice(0, 160), subtitle: company?.name ?? 'Job dispute', status: optional(dispute.status),
      sections: [{ id: 'dispute', title: 'Job dispute state', fields: [field('status', 'Status', dispute.status), field('description', 'Description', dispute.description), field('raised', 'Raised', dispute.created_at), field('updated', 'Updated', dispute.updated_at), field('resolution', 'Resolution note', dispute.resolution_note), field('resolved_at', 'Resolved', dispute.resolved_at)] }],
      relationshipGroups: [
        { id: 'job', title: 'Job', rows: job.data ? compactRelations([relation('job', job.data.id, job.data.title ?? `${job.data.pickup_location ?? 'Pickup'} → ${job.data.delivery_location ?? 'Delivery'}`, job.data.load_ref ?? job.data.load_id, job.data.status)]) : [] },
        { id: 'company', title: 'Raised by company', rows: company ? compactRelations([relation('company', company.id, company.name ?? 'Company', company.xd_id ?? company.company_number, company.status)]) : [] },
        { id: 'resolver', title: 'Resolver', rows: resolver ? compactRelations([relation('user', resolver.user_id, resolver.full_name ?? 'User', resolver.xd_id, resolver.status)]) : [] },
      ],
    };
  }

  const invoiceResult = await supabaseAdmin.from('invoice_disputes').select('id, invoice_id, company_id, buyer_company_id, supplier_company_id, job_id, reason, details, status, resolution_note, created_at, resolved_at').eq('id', entityId).maybeSingle();
  if (invoiceResult.error) throw new Error(invoiceResult.error.message);
  const dispute = invoiceResult.data;
  if (!dispute) return null;
  const [company, buyer, supplier, invoice, job] = await Promise.all([
    companySummary(dispute.company_id), companySummary(dispute.buyer_company_id), companySummary(dispute.supplier_company_id),
    dispute.invoice_id ? supabaseAdmin.from('invoices').select('id, invoice_number, status, payment_status, job_id').eq('id', dispute.invoice_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    dispute.job_id ? supabaseAdmin.from('jobs').select('id, load_ref, load_id, title, status, pickup_location, delivery_location').eq('id', dispute.job_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const result of [invoice, job]) if (result.error) throw new Error(result.error.message);
  return {
    available: true, entityType: 'dispute', entityId, stableId: entityId, reference: entityId,
    title: value(dispute.reason, 'Invoice dispute').slice(0, 160), subtitle: company?.name ?? buyer?.name ?? supplier?.name ?? 'Invoice dispute', status: optional(dispute.status),
    sections: [{ id: 'dispute', title: 'Invoice dispute state', fields: [field('status', 'Status', dispute.status), field('reason', 'Reason', dispute.reason), field('details', 'Details', dispute.details), field('raised', 'Raised', dispute.created_at), field('resolution', 'Resolution note', dispute.resolution_note), field('resolved_at', 'Resolved', dispute.resolved_at)] }],
    relationshipGroups: [
      { id: 'invoice', title: 'Invoice', rows: invoice.data ? compactRelations([relation('invoice', invoice.data.id, invoice.data.invoice_number ?? 'Invoice', invoice.data.invoice_number, invoice.data.payment_status ?? invoice.data.status)]) : [] },
      { id: 'job', title: 'Job', rows: job.data ? compactRelations([relation('job', job.data.id, job.data.title ?? `${job.data.pickup_location ?? 'Pickup'} → ${job.data.delivery_location ?? 'Delivery'}`, job.data.load_ref ?? job.data.load_id, job.data.status)]) : [] },
      { id: 'companies', title: 'Companies', rows: compactRelations([relation('company', company?.id, company?.name ?? 'Company', company?.xd_id ?? company?.company_number, company?.status), relation('company', buyer?.id, `Buyer · ${buyer?.name ?? 'Company'}`, buyer?.xd_id ?? buyer?.company_number, buyer?.status), relation('company', supplier?.id, `Supplier · ${supplier?.name ?? 'Company'}`, supplier?.xd_id ?? supplier?.company_number, supplier?.status)]) },
    ],
  };
}

async function inspectPod(entityId: string): Promise<InspectorPayload | null> {
  if (!supabaseAdmin) return null;
  const { data: job, error } = await supabaseAdmin.from('jobs').select('id, load_ref, load_id, booking_reference, status, pickup_location, delivery_location, assigned_driver_id, vehicle_id, company_id, awarded_carrier_company_id, pod_required, pod_generated, pod_generated_at, delivery_photos, pod_photos, pickup_photos, delivery_signature_data, client_signature_name, hard_copy_pod, delivery_notes, delivered_at, completed_at, broker_pod_review_status, broker_pod_review_note, broker_pod_reviewed_at').eq('id', entityId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) return null;
  const [postingCompany, carrierCompany, driver, vehicle, invoices] = await Promise.all([
    companySummary(job.company_id), companySummary(job.awarded_carrier_company_id),
    job.assigned_driver_id ? supabaseAdmin.from('drivers').select('id, display_name, full_name, name, status, reg_number').eq('id', job.assigned_driver_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    job.vehicle_id ? supabaseAdmin.from('vehicles').select('id, reg, registration, reg_plate, make, model, status').eq('id', job.vehicle_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from('invoices').select('id, invoice_number, status, payment_status').eq('job_id', entityId).order('created_at', { ascending: false }).limit(25),
  ]);
  for (const result of [driver, vehicle, invoices]) if (result.error) throw new Error(result.error.message);
  const podPhotos = Array.isArray(job.pod_photos) ? job.pod_photos.length : 0;
  const deliveryPhotos = Array.isArray(job.delivery_photos) ? job.delivery_photos.length : 0;
  const pickupPhotos = Array.isArray(job.pickup_photos) ? job.pickup_photos.length : 0;
  const hasEvidence = Boolean(job.pod_generated || job.delivery_signature_data || podPhotos || deliveryPhotos || job.hard_copy_pod);
  const reference = job.load_ref ?? job.load_id ?? job.booking_reference ?? job.id;
  return {
    available: true, entityType: 'pod', entityId, stableId: entityId, reference: value(reference), title: `POD · ${value(job.pickup_location, 'Pickup')} → ${value(job.delivery_location, 'Delivery')}`,
    subtitle: hasEvidence ? 'Canonical delivery evidence is present.' : 'POD record resolves to the canonical job but evidence is not present.', status: hasEvidence ? 'evidence_present' : job.pod_required ? 'required' : 'not_present',
    sections: [
      { id: 'evidence', title: 'Physical evidence', fields: [field('required', 'POD required', job.pod_required), field('generated', 'POD generated', job.pod_generated), field('generated_at', 'Generated at', job.pod_generated_at), field('signature', 'Signature present', Boolean(job.delivery_signature_data)), field('signatory', 'Signatory', job.client_signature_name), field('pickup_photos', 'Pickup photos', pickupPhotos), field('delivery_photos', 'Delivery photos', deliveryPhotos), field('pod_photos', 'POD photos', podPhotos), field('hard_copy', 'Hard-copy POD', job.hard_copy_pod)], unavailable: !hasEvidence, unavailableReason: !hasEvidence ? 'No physical POD evidence is stored on the canonical job.' : undefined },
      { id: 'delivery', title: 'Delivery state', fields: [field('job_status', 'Job status', job.status), field('delivered', 'Delivered at', job.delivered_at), field('completed', 'Completed at', job.completed_at), field('delivery_notes', 'Delivery notes', job.delivery_notes), field('broker_review', 'Broker POD review', job.broker_pod_review_status), field('broker_note', 'Broker review note', job.broker_pod_review_note), field('broker_reviewed', 'Broker reviewed at', job.broker_pod_reviewed_at)] },
    ],
    relationshipGroups: [
      { id: 'job', title: 'Canonical job', rows: compactRelations([relation('job', job.id, `${job.pickup_location ?? 'Pickup'} → ${job.delivery_location ?? 'Delivery'}`, reference, job.status)]) },
      { id: 'companies', title: 'Companies', rows: compactRelations([relation('company', postingCompany?.id, `Posting company · ${postingCompany?.name ?? 'Company'}`, postingCompany?.xd_id ?? postingCompany?.company_number, postingCompany?.status), relation('company', carrierCompany?.id, `Executing company · ${carrierCompany?.name ?? 'Company'}`, carrierCompany?.xd_id ?? carrierCompany?.company_number, carrierCompany?.status)]) },
      { id: 'driver', title: 'Driver', rows: driver.data ? compactRelations([relation('driver', driver.data.id, driver.data.display_name ?? driver.data.full_name ?? driver.data.name ?? 'Driver', driver.data.reg_number, driver.data.status)]) : [] },
      { id: 'vehicle', title: 'Vehicle', rows: vehicle.data ? compactRelations([relation('vehicle', vehicle.data.id, [vehicle.data.make, vehicle.data.model].filter(Boolean).join(' ') || 'Vehicle', vehicle.data.registration ?? vehicle.data.reg_plate ?? vehicle.data.reg, vehicle.data.status)]) : [] },
      { id: 'invoices', title: 'Invoices consuming this delivery', rows: compactRelations((invoices.data ?? []).map((row) => relation('invoice', row.id, row.invoice_number ?? 'Invoice', row.invoice_number, row.payment_status ?? row.status))) },
    ],
  };
}

async function inspectCase(entityId: string): Promise<InspectorPayload> {
  if (!supabaseAdmin) throw new Error('Server auth is not configured.');
  const { data: platformCase, error } = await supabaseAdmin.from('platform_cases').select('id, reference, source, case_type, severity, status, title, description, entity_type, entity_id, entity_label, company_id, assigned_to_user_id, created_by_user_id, detected_at, acknowledged_at, resolved_at, closed_at, created_at, updated_at').eq('id', entityId).maybeSingle();
  if (isCaseSchemaUnavailable(error)) {
    return { available: false, entityType: 'case', entityId, stableId: entityId, reference: entityId, title: 'Platform case unavailable', status: null, sections: [], relationshipGroups: [], note: 'Platform Case Centre schema is not applied in this environment.' };
  }
  if (error) throw new Error(error.message);
  if (!platformCase) throw Object.assign(new Error('Platform case not found.'), { statusCode: 404 });
  const [events, company, assignee, creator] = await Promise.all([
    supabaseAdmin.from('platform_case_events').select('id, actor_user_id, event_type, old_status, new_status, reason, created_at').eq('case_id', entityId).order('created_at', { ascending: false }).limit(100),
    companySummary(platformCase.company_id), profileSummary(platformCase.assigned_to_user_id), profileSummary(platformCase.created_by_user_id),
  ]);
  if (events.error) throw new Error(events.error.message);
  const linkedType = ENTITY_TYPES.has(String(platformCase.entity_type)) ? String(platformCase.entity_type) : null;
  return {
    available: true, entityType: 'case', entityId, stableId: entityId, reference: value(platformCase.reference), title: value(platformCase.title, 'Platform case'), subtitle: [platformCase.source, platformCase.case_type, platformCase.entity_label].filter(Boolean).join(' · '), status: optional(platformCase.status),
    sections: [
      { id: 'case', title: 'Case state', fields: [field('severity', 'Severity', platformCase.severity), field('status', 'Status', platformCase.status), field('source', 'Source', platformCase.source), field('case_type', 'Case type', platformCase.case_type), field('description', 'Description', platformCase.description), field('detected', 'Detected', platformCase.detected_at), field('acknowledged', 'Acknowledged', platformCase.acknowledged_at), field('resolved', 'Resolved', platformCase.resolved_at), field('closed', 'Closed', platformCase.closed_at)] },
      { id: 'ownership', title: 'Case ownership', fields: [field('assigned_to', 'Assigned to', assignee?.full_name), field('created_by', 'Created by', creator?.full_name), field('company', 'Company', company?.name), field('events', 'Loaded audit events', (events.data ?? []).length)] },
    ],
    relationshipGroups: [
      { id: 'subject', title: 'Case subject', rows: linkedType ? compactRelations([relation(linkedType, platformCase.entity_id, platformCase.entity_label, platformCase.entity_id)]) : [] },
      { id: 'company', title: 'Company', rows: company ? compactRelations([relation('company', company.id, company.name ?? 'Company', company.xd_id ?? company.company_number, company.status)]) : [] },
      { id: 'users', title: 'Platform operators', rows: compactRelations([relation('user', assignee?.user_id, `Assigned · ${assignee?.full_name ?? 'Platform Owner'}`, assignee?.xd_id, assignee?.status), relation('user', creator?.user_id, `Created by · ${creator?.full_name ?? 'Platform Owner'}`, creator?.xd_id, creator?.status)]) },
    ],
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ entityType: string; entityId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { entityType: rawType, entityId: rawId } = await context.params;
  const entityType = decodeURIComponent(rawType).toLowerCase();
  const entityId = decodeURIComponent(rawId).trim();
  if (!ENTITY_TYPES.has(entityType)) return respond(400, { error: 'Unsupported Platform Entity Inspector type.' });
  if (!entityId || entityId.length > 240) return respond(400, { error: 'Invalid entity identifier.' });

  try {
    let payload: InspectorPayload | null;
    switch (entityType) {
      case 'company': payload = await inspectCompany(entityId); break;
      case 'user': payload = await inspectUser(entityId); break;
      case 'driver': payload = await inspectDriver(entityId); break;
      case 'vehicle': payload = await inspectVehicle(entityId); break;
      case 'job': payload = await inspectJob(entityId); break;
      case 'invoice': payload = await inspectInvoice(entityId); break;
      case 'ticket': payload = await inspectTicket(entityId); break;
      case 'dispute': payload = await inspectDispute(entityId); break;
      case 'pod': payload = await inspectPod(entityId); break;
      case 'case': payload = await inspectCase(entityId); break;
      default: payload = null;
    }
    if (!payload) return respond(404, { error: `${entityType} entity not found.` });
    return respond(200, payload as unknown as Record<string, unknown>);
  } catch (error) {
    const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number((error as { statusCode?: number }).statusCode) : 500;
    return respond(statusCode === 404 ? 404 : 500, { error: error instanceof Error ? error.message : 'Platform Entity Inspector failed.' });
  }
}
