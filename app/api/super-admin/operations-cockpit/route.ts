import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const ACTIVE_JOB_STATUSES = [
  'allocated', 'accepted', 'assigned', 'in_progress', 'on_my_way', 'on_my_way_to_pickup',
  'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
];
const OPEN_JOB_STATUSES = [
  'draft', 'received', 'posted', 'quoted', 'awarded', ...ACTIVE_JOB_STATUSES,
];
const ONLINE_LOCATION_MAX_AGE_MS = 30 * 60_000;
const MAP_LOCATION_MAX_AGE_MS = 24 * 60 * 60_000;
const MAX_LOCATION_ROWS = 2_000;
const MAX_JOB_ROWS = 100;
const MAX_FINANCE_ROWS = 2_000;

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const iso = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};
const coordinate = (...values: unknown[]) => values.map(num).find((value) => value !== null) ?? null;

const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const startOfUtcWeek = (date: Date) => {
  const day = (date.getUTCDay() + 6) % 7;
  const start = startOfUtcDay(date);
  start.setUTCDate(start.getUTCDate() - day);
  return start;
};
const startOfUtcMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const now = new Date();
  const nowMs = now.getTime();
  const locationCutoff = new Date(nowMs - MAP_LOCATION_MAX_AGE_MS).toISOString();
  const financeCutoff = new Date(nowMs - 35 * 24 * 60 * 60_000).toISOString();

  const [driversResult, locationsResult, vehiclesResult, vehicleDocsResult, jobsResult, paymentsResult, invoicesResult, urgentCasesResult, urgentSupportResult] = await Promise.all([
    supabaseAdmin.from('drivers').select('id, user_id, company_id, display_name, full_name, name, availability_status, last_app_login, is_active').order('display_name', { ascending: true }),
    supabaseAdmin.from('driver_locations').select('id, driver_id, vehicle_id, job_id, lat, lng, heading, speed_mph, recorded_at, source').gte('recorded_at', locationCutoff).order('recorded_at', { ascending: false }).limit(MAX_LOCATION_ROWS),
    supabaseAdmin.from('vehicles').select('id, company_id, assigned_driver_id, registration, reg_plate, reg, make, model, vehicle_type, type, status, current_status, is_available, is_tracked, last_tracked_at, has_tail_lift, equipment, pallets_capacity, payload_kg, capacity_kg, loading_capacity_m3, international_work_approved').order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('vehicle_documents').select('vehicle_id, status, expiry_date'),
    supabaseAdmin.from('jobs').select('id, company_id, client_name, status, pickup_location, pickup_postcode, pickup_city, delivery_location, delivery_postcode, delivery_city, pickup_datetime, delivery_datetime, deadline_at, assigned_driver_id, vehicle_id, price, agreed_rate_gbp, budget_amount, currency, pickup_lat, pickup_lng, delivery_lat, delivery_lng, pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude, created_at').order('created_at', { ascending: false }).limit(MAX_JOB_ROWS),
    supabaseAdmin.from('invoice_payment_history').select('id, company_id, invoice_id, amount, currency, paid_at, created_at').gte('paid_at', financeCutoff).order('paid_at', { ascending: false }).limit(MAX_FINANCE_ROWS),
    supabaseAdmin.from('invoices').select('id, company_id, job_id, client_name, amount, total, currency, status, payment_status, due_date, invoice_date, created_at').order('created_at', { ascending: false }).limit(MAX_FINANCE_ROWS),
    supabaseAdmin.from('platform_cases').select('id', { count: 'exact', head: true }).in('severity', ['P0', 'P1']).in('status', ['open', 'acknowledged', 'investigating', 'waiting']),
    supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('priority', 'critical').in('status', ['open', 'investigating']),
  ]);

  const required = [driversResult, locationsResult, vehiclesResult, vehicleDocsResult, jobsResult, paymentsResult, invoicesResult];
  const failed = required.find((result) => result.error);
  if (failed?.error) return respond(500, { error: `Operations cockpit source unavailable: ${failed.error.message}` });
  if (urgentCasesResult.error || urgentSupportResult.error || typeof urgentCasesResult.count !== 'number' || typeof urgentSupportResult.count !== 'number') {
    return respond(500, { error: 'Urgent-request sources returned an incomplete snapshot.' });
  }

  const drivers = driversResult.data ?? [];
  const locations = locationsResult.data ?? [];
  const vehicles = vehiclesResult.data ?? [];
  const jobs = jobsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  const companyIds = Array.from(new Set([
    ...drivers.map((row) => text(row.company_id)).filter((value): value is string => Boolean(value)),
    ...vehicles.map((row) => text(row.company_id)).filter((value): value is string => Boolean(value)),
    ...jobs.map((row) => text(row.company_id)).filter((value): value is string => Boolean(value)),
    ...invoices.map((row) => text(row.company_id)).filter((value): value is string => Boolean(value)),
  ]));
  const userIds = Array.from(new Set(drivers.map((row) => text(row.user_id)).filter((value): value is string => Boolean(value))));

  const [companiesResult, ratingsResult, etaResult] = await Promise.all([
    companyIds.length ? supabaseAdmin.from('companies').select('id, name').in('id', companyIds) : Promise.resolve({ data: [], error: null }),
    userIds.length ? supabaseAdmin.from('reviews').select('reviewed_user_id, rating').in('reviewed_user_id', userIds) : Promise.resolve({ data: [], error: null }),
    jobs.length ? supabaseAdmin.from('job_tracking_eta_snapshots').select('job_id, eta_at, remaining_minutes, remaining_miles, late_by_minutes, calculated_at, source').in('job_id', jobs.map((row) => String(row.id))) : Promise.resolve({ data: [], error: null }),
  ]);
  if (companiesResult.error || ratingsResult.error || etaResult.error) {
    return respond(500, { error: companiesResult.error?.message ?? ratingsResult.error?.message ?? etaResult.error?.message ?? 'Cockpit enrichment failed.' });
  }

  const companyNameById = new Map((companiesResult.data ?? []).map((row) => [String(row.id), String(row.name ?? 'Unknown company')]));
  const latestLocationByDriver = new Map<string, (typeof locations)[number]>();
  for (const row of locations) {
    const driverId = String(row.driver_id ?? '');
    if (driverId && !latestLocationByDriver.has(driverId)) latestLocationByDriver.set(driverId, row);
  }
  const vehicleByDriver = new Map<string, (typeof vehicles)[number]>();
  for (const vehicle of vehicles) {
    const driverId = text(vehicle.assigned_driver_id);
    if (driverId && !vehicleByDriver.has(driverId)) vehicleByDriver.set(driverId, vehicle);
  }

  const ratingsByUser = new Map<string, number[]>();
  for (const row of ratingsResult.data ?? []) {
    const userId = text(row.reviewed_user_id);
    const rating = num(row.rating);
    if (!userId || rating === null) continue;
    ratingsByUser.set(userId, [...(ratingsByUser.get(userId) ?? []), rating]);
  }
  const etaByJob = new Map((etaResult.data ?? []).map((row) => [String(row.job_id), row]));

  const driverCards = drivers.map((driver) => {
    const driverId = String(driver.id);
    const latest = latestLocationByDriver.get(driverId) ?? null;
    const recordedAt = iso(latest?.recorded_at);
    const ageMs = recordedAt ? nowMs - Date.parse(recordedAt) : Number.POSITIVE_INFINITY;
    const baseAvailability = text(driver.availability_status) ?? 'offline';
    const online = Boolean(driver.is_active !== false && ageMs <= ONLINE_LOCATION_MAX_AGE_MS && baseAvailability !== 'offline');
    const status = online ? (baseAvailability === 'busy' ? 'busy' : 'online') : 'offline';
    const assignedVehicle = vehicleByDriver.get(driverId) ?? null;
    const userId = text(driver.user_id);
    const ratings = userId ? ratingsByUser.get(userId) ?? [] : [];
    const rating = ratings.length ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10 : null;
    return {
      id: driverId,
      user_id: userId,
      company_name: text(driver.company_id) ? companyNameById.get(String(driver.company_id)) ?? 'Unknown company' : '—',
      name: text(driver.display_name) ?? text(driver.full_name) ?? text(driver.name) ?? 'Unknown driver',
      status,
      availability_status: baseAvailability,
      online,
      last_activity_at: recordedAt ?? iso(driver.last_app_login),
      rating,
      review_count: ratings.length,
      vehicle: assignedVehicle ? {
        id: String(assignedVehicle.id),
        registration: text(assignedVehicle.registration) ?? text(assignedVehicle.reg_plate) ?? text(assignedVehicle.reg) ?? '—',
        label: [text(assignedVehicle.make), text(assignedVehicle.model)].filter(Boolean).join(' ') || text(assignedVehicle.vehicle_type) || text(assignedVehicle.type) || 'Vehicle',
      } : null,
      location: latest && num(latest.lat) !== null && num(latest.lng) !== null ? {
        lat: num(latest.lat), lng: num(latest.lng), heading: num(latest.heading), speed_mph: num(latest.speed_mph), recorded_at: recordedAt, source: text(latest.source),
        vehicle_id: text(latest.vehicle_id), job_id: text(latest.job_id),
      } : null,
    };
  });

  const vehicleDocs = vehicleDocsResult.data ?? [];
  const blockedVehicleIds = new Set<string>();
  const todayIso = startOfUtcDay(now).toISOString().slice(0, 10);
  for (const document of vehicleDocs) {
    const vehicleId = text(document.vehicle_id);
    if (!vehicleId) continue;
    const status = text(document.status)?.toLowerCase();
    const expiry = text(document.expiry_date);
    if (status === 'rejected' || status === 'expired' || (expiry && expiry < todayIso)) blockedVehicleIds.add(vehicleId);
  }

  const fleetCards = vehicles.map((vehicle) => {
    const id = String(vehicle.id);
    const registration = text(vehicle.registration) ?? text(vehicle.reg_plate) ?? text(vehicle.reg) ?? '—';
    const payload = num(vehicle.payload_kg) ?? num(vehicle.capacity_kg);
    const operationallyHealthy = !blockedVehicleIds.has(id) && text(vehicle.status)?.toLowerCase() !== 'suspended' && text(vehicle.status)?.toLowerCase() !== 'inactive';
    return {
      id,
      company_name: text(vehicle.company_id) ? companyNameById.get(String(vehicle.company_id)) ?? 'Unknown company' : '—',
      registration,
      label: [text(vehicle.make), text(vehicle.model)].filter(Boolean).join(' ') || text(vehicle.vehicle_type) || text(vehicle.type) || 'Vehicle',
      status: text(vehicle.current_status) ?? text(vehicle.status) ?? 'unknown',
      available: vehicle.is_available === true,
      tracked: vehicle.is_tracked === true,
      last_tracked_at: iso(vehicle.last_tracked_at),
      tail_lift: vehicle.has_tail_lift === true,
      equipment: Array.isArray(vehicle.equipment) ? vehicle.equipment : [],
      pallets_capacity: num(vehicle.pallets_capacity),
      payload_kg: payload,
      loading_capacity_m3: num(vehicle.loading_capacity_m3),
      international_work_approved: vehicle.international_work_approved === true,
      assigned_driver_id: text(vehicle.assigned_driver_id),
      operationally_healthy: operationallyHealthy,
      compliance_blocked: blockedVehicleIds.has(id),
      mileage: null,
      service_due: null,
    };
  });
  const fleetHealth = fleetCards.length ? Math.round((fleetCards.filter((row) => row.operationally_healthy).length / fleetCards.length) * 100) : null;

  const jobCards = jobs.map((job) => {
    const id = String(job.id);
    const eta = etaByJob.get(id) ?? null;
    const status = text(job.status) ?? 'unknown';
    const price = num(job.agreed_rate_gbp) ?? num(job.price) ?? num(job.budget_amount);
    const pickupLat = coordinate(job.pickup_lat, job.pickup_latitude);
    const pickupLng = coordinate(job.pickup_lng, job.pickup_longitude);
    const deliveryLat = coordinate(job.delivery_lat, job.dropoff_latitude);
    const deliveryLng = coordinate(job.delivery_lng, job.dropoff_longitude);
    const driver = driverCards.find((row) => row.id === text(job.assigned_driver_id)) ?? null;
    const vehicle = fleetCards.find((row) => row.id === text(job.vehicle_id)) ?? null;
    return {
      id,
      short_id: id.slice(0, 8).toUpperCase(),
      client: text(job.client_name) ?? (text(job.company_id) ? companyNameById.get(String(job.company_id)) ?? 'Unknown company' : '—'),
      status,
      pickup: text(job.pickup_location) ?? text(job.pickup_city) ?? text(job.pickup_postcode) ?? '—',
      pickup_postcode: text(job.pickup_postcode),
      delivery: text(job.delivery_location) ?? text(job.delivery_city) ?? text(job.delivery_postcode) ?? '—',
      delivery_postcode: text(job.delivery_postcode),
      pickup_at: iso(job.pickup_datetime),
      delivery_at: iso(job.delivery_datetime),
      deadline_at: iso(job.deadline_at),
      driver_id: text(job.assigned_driver_id),
      driver_name: driver?.name ?? null,
      vehicle_id: text(job.vehicle_id),
      vehicle_registration: vehicle?.registration ?? null,
      price,
      currency: (text(job.currency) ?? 'GBP').toUpperCase(),
      eta: eta ? {
        eta_at: iso(eta.eta_at),
        remaining_minutes: num(eta.remaining_minutes),
        remaining_miles: num(eta.remaining_miles),
        late_by_minutes: num(eta.late_by_minutes),
        calculated_at: iso(eta.calculated_at),
        source: text(eta.source),
      } : null,
      map: { pickup_lat: pickupLat, pickup_lng: pickupLng, delivery_lat: deliveryLat, delivery_lng: deliveryLng },
      created_at: iso(job.created_at),
    };
  });

  const activeJobs = jobCards.filter((job) => OPEN_JOB_STATUSES.includes(job.status.toLowerCase()));
  const executingJobs = jobCards.filter((job) => ACTIVE_JOB_STATUSES.includes(job.status.toLowerCase()));
  const lateJobIds = new Set<string>();
  for (const job of activeJobs) {
    const lateByEta = job.eta?.late_by_minutes != null && job.eta.late_by_minutes > 0;
    const plannedAt = job.deadline_at ?? job.delivery_at;
    const lateByClock = plannedAt ? Date.parse(plannedAt) < nowMs : false;
    if (lateByEta || lateByClock) lateJobIds.add(job.id);
  }

  const currencies = Array.from(new Set(payments.map((row) => (text(row.currency) ?? 'GBP').toUpperCase())));
  const financeCurrency = currencies.length === 1 ? currencies[0] : currencies.length === 0 ? 'GBP' : null;
  const dayStart = startOfUtcDay(now).getTime();
  const weekStart = startOfUtcWeek(now).getTime();
  const monthStart = startOfUtcMonth(now).getTime();
  const paidAtMs = (row: (typeof payments)[number]) => Date.parse(String(row.paid_at ?? row.created_at ?? ''));
  const sumPayments = (start: number) => payments.filter((row) => {
    const timestamp = paidAtMs(row);
    return Number.isFinite(timestamp) && timestamp >= start;
  }).reduce((sum, row) => sum + (num(row.amount) ?? 0), 0);

  const clientTotals = new Map<string, number>();
  for (const invoice of invoices) {
    const amount = num(invoice.total) ?? num(invoice.amount) ?? 0;
    const client = text(invoice.client_name) ?? (text(invoice.company_id) ? companyNameById.get(String(invoice.company_id)) ?? 'Unknown company' : 'Unknown client');
    clientTotals.set(client, (clientTotals.get(client) ?? 0) + amount);
  }
  const outstandingInvoices = invoices.filter((invoice) => {
    const paymentStatus = text(invoice.payment_status)?.toLowerCase();
    const status = text(invoice.status)?.toLowerCase();
    return ['unpaid', 'partially_paid', 'overdue', 'disputed'].includes(paymentStatus ?? '') && !['paid', 'void', 'cancelled'].includes(status ?? '');
  });

  return respond(200, {
    refreshedAt: now.toISOString(),
    definitions: {
      driversOnline: 'Active driver with available/busy presence and a location sample no older than 30 minutes.',
      fleetHealth: 'Operational readiness: active vehicle with no rejected/expired vehicle-compliance document. This is not a mechanical telemetry score.',
      lateDeliveries: 'Open job whose cached traffic ETA is late or whose planned delivery/deadline has passed.',
      revenue: 'Recorded invoice payment-history settlements. UTC calendar boundaries are used in this read-only cockpit.',
    },
    kpis: {
      activeJobs: activeJobs.length,
      driversOnline: driverCards.filter((driver) => driver.online).length,
      fleetHealth,
      lateDeliveries: lateJobIds.size,
      revenueToday: financeCurrency ? sumPayments(dayStart) : null,
      urgentRequests: (urgentCasesResult.count ?? 0) + (urgentSupportResult.count ?? 0),
      currency: financeCurrency,
      mixedCurrency: financeCurrency === null,
    },
    map: {
      drivers: driverCards.filter((driver) => driver.location && driver.location.lat !== null && driver.location.lng !== null),
      jobs: executingJobs.filter((job) => job.map.pickup_lat !== null || job.map.delivery_lat !== null),
      routes: executingJobs.filter((job) => job.map.pickup_lat !== null && job.map.pickup_lng !== null && job.map.delivery_lat !== null && job.map.delivery_lng !== null),
      trafficEtaSource: 'job_tracking_eta_snapshots',
      providerCallsTriggered: false,
    },
    jobs: jobCards,
    drivers: driverCards,
    fleet: fleetCards,
    finance: {
      currency: financeCurrency,
      mixedCurrency: financeCurrency === null,
      revenueToday: financeCurrency ? sumPayments(dayStart) : null,
      revenueWeek: financeCurrency ? sumPayments(weekStart) : null,
      revenueMonth: financeCurrency ? sumPayments(monthStart) : null,
      outstandingInvoices: outstandingInvoices.length,
      topClients: Array.from(clientTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, invoicedValue: value })),
      driverPayments: null,
      profitabilityPerRoute: null,
      unavailable: [
        'Driver payments: no canonical driver-payment ledger is present.',
        'Profitability per route: no authoritative route cost ledger is present, so profit is not inferred.',
      ],
    },
    capabilities: {
      apiKeyManagement: false,
      xeroIntegrationManagement: false,
      courierExchangeIntegrationManagement: false,
      stripeIntegrationVisibility: true,
      backupRestoreDirectAction: false,
      vehicleMileage: false,
      vehicleServiceDue: false,
    },
  });
}
