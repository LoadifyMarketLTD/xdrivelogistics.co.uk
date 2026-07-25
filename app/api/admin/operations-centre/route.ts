import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, supabaseValidator } from '../../_lib/supabaseAdmin';
import { toCanonicalInvoiceStatusWithDueDate } from '../../../../lib/invoiceStatus';
import { coordinatesFromLocation } from '../../../../lib/geoLocation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
const liveStatuses = new Set(['allocated', 'awarded', 'on_my_way', 'on_site_pickup', 'loaded', 'on_site_delivery', 'in_transit', 'on_site', 'collected']);
const completeStatuses = new Set(['delivered', 'completed', 'invoiced', 'paid']);
const delayedStatuses = new Set(['delayed', 'disputed', 'failed']);
const pendingInvoiceStatuses = new Set(['Draft', 'Sent', 'Overdue', 'Disputed']);
const nextTransition: Record<string, { status: string; label: string }> = {
  awarded: { status: 'on_my_way', label: 'Start pickup route' },
  allocated: { status: 'on_my_way', label: 'Start pickup route' },
  on_my_way: { status: 'on_site_pickup', label: 'Arrived pickup' },
  on_site_pickup: { status: 'loaded', label: 'Mark loaded' },
  loaded: { status: 'in_transit', label: 'Start transit' },
  collected: { status: 'in_transit', label: 'Start transit' },
  in_transit: { status: 'on_site_delivery', label: 'Arrived delivery' },
  on_site_delivery: { status: 'delivered', label: 'Mark delivered' },
  delivered: { status: 'completed', label: 'Complete job' },
};

type JobRow = {
  id: string;
  status: string | null;
  current_status: string | null;
  assigned_driver_id: string | null;
  assigned_company_id: string | null;
  awarded_carrier_company_id: string | null;
  company_id: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  budget_amount: number | string | null;
  delivery_photos: unknown;
  pod_photos: unknown;
  pod_generated: boolean | null;
  pod_required: boolean | null;
  status_history: unknown;
  updated_at: string | null;
  created_at: string | null;
};

type DriverRow = { id: string; display_name: string | null; availability_status: string | null; status: string | null; company_id: string | null };
type VehicleRow = { id: string; reg_plate: string | null; type: string | null; assigned_driver_id: string | null; company_id: string | null };
type DriverLocationRow = { id: string; driver_id: string; location: unknown; recorded_at: string | null };
type BidRow = { id: string; job_id: string; status: string | null; created_at: string | null };
type NotificationRow = { id: string; event_type: string | null; entity_type: string | null; entity_id: string | null; payload: unknown; status: string | null; created_at: string | null };
type TrackingRow = { id: string; job_id: string; event_type: string | null; message: string | null; created_at: string | null; created_by: string | null };
type DocumentRow = { id: string; status: string | null; expiry_date: string | null; doc_type: string | null; created_at: string | null };

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textFrom(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function notificationTitle(event: NotificationRow) {
  const payload = asRecord(event.payload);
  return textFrom(payload.title) ?? textFrom(payload.subject) ?? statusLabel(event.event_type);
}

function notificationDetail(event: NotificationRow) {
  const payload = asRecord(event.payload);
  return textFrom(payload.body) ?? textFrom(payload.message) ?? textFrom(payload.description) ?? event.status ?? 'Notification';
}

function hasPod(job: JobRow) {
  return Boolean(job.pod_generated) || safeArray(job.pod_photos).length > 0 || safeArray(job.delivery_photos).length > 0;
}

function statusLabel(status: unknown) {
  const normalized = norm(status);
  if (!normalized) return 'Unknown';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTime(value: string | null | undefined) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function relativeTime(value: string | null | undefined) {
  if (!value) return 'now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'now';
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function progressForStatus(status: unknown) {
  const value = norm(status);
  if (completeStatuses.has(value)) return 100;
  if (value === 'on_site_delivery') return 86;
  if (value === 'in_transit' || value === 'loaded' || value === 'collected') return 70;
  if (value === 'on_site_pickup' || value === 'on_site') return 48;
  if (value === 'on_my_way') return 30;
  if (value === 'allocated' || value === 'awarded') return 18;
  return 8;
}

function toneForStatus(status: unknown) {
  const value = norm(status);
  if (delayedStatuses.has(value)) return 'red';
  if (['on_site_pickup', 'on_site_delivery', 'on_site'].includes(value)) return 'amber';
  if (['loaded', 'in_transit', 'collected'].includes(value)) return 'blue';
  if (completeStatuses.has(value) || liveStatuses.has(value)) return 'green';
  return 'slate';
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function sameDay(value: string | null | undefined, day = startOfDay()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === day.toISOString().slice(0, 10);
}

function minutesBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

async function resolveCompanyId(client: SupabaseClient, userId: string) {
  const [profileRes, membershipRes] = await Promise.all([
    client.from('profiles').select('company_id, role').eq('user_id', userId).maybeSingle(),
    client.from('company_memberships').select('company_id').eq('user_id', userId).eq('status', 'active').limit(1),
  ]);
  const profile = profileRes.data as { company_id?: unknown; role?: unknown } | null;
  const memberships = membershipRes.data as Array<{ company_id?: unknown }> | null;
  const profileCompany = typeof profile?.company_id === 'string' ? profile.company_id : null;
  const membershipCompany = Array.isArray(memberships) && typeof memberships[0]?.company_id === 'string' ? memberships[0].company_id : null;
  return { companyId: profileCompany ?? membershipCompany, role: typeof profile?.role === 'string' ? profile.role : null };
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) return respond(503, { error: 'Supabase client is not configured.' });
  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const validator = supabaseValidator ?? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Invalid session.' });

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { searchParams } = new URL(request.url);
  const requestedCompany = searchParams.get('companyId');
  const query = norm(searchParams.get('q'));
  const statusFilter = norm(searchParams.get('status') ?? 'all');
  const dateFilter = norm(searchParams.get('date') ?? 'today');
  const sort = norm(searchParams.get('sort') ?? 'priority');
  const limit = Math.min(Number(searchParams.get('limit') ?? 80) || 80, 250);
  const { companyId, role } = await resolveCompanyId(client, authData.user.id);
  const activeCompanyId = requestedCompany || companyId;
  if (!activeCompanyId && role !== 'owner') return respond(403, { error: 'No active company context.' });

  const companyScope = activeCompanyId
    ? `company_id.eq.${activeCompanyId},assigned_company_id.eq.${activeCompanyId},awarded_carrier_company_id.eq.${activeCompanyId}`
    : 'id.not.is.null';

  const [
    jobsRes,
    driversRes,
    vehiclesRes,
    locationsRes,
    bidsRes,
    notificationsRes,
    trackingRes,
    invoicesRes,
    driverDocsRes,
    vehicleDocsRes,
  ] = await Promise.all([
    client.from('jobs').select('id,status,current_status,assigned_driver_id,assigned_company_id,awarded_carrier_company_id,company_id,pickup_location,delivery_location,pickup_datetime,delivery_datetime,vehicle_type,requested_vehicle_type,budget_amount,delivery_photos,pod_photos,pod_generated,pod_required,status_history,updated_at,created_at').or(companyScope).order('updated_at', { ascending: false }).limit(limit),
    activeCompanyId ? client.from('drivers').select('id,display_name,availability_status,status,company_id').eq('company_id', activeCompanyId).limit(500) : client.from('drivers').select('id,display_name,availability_status,status,company_id').limit(500),
    activeCompanyId ? client.from('vehicles').select('id,reg_plate,type,assigned_driver_id,company_id').eq('company_id', activeCompanyId).limit(500) : client.from('vehicles').select('id,reg_plate,type,assigned_driver_id,company_id').limit(500),
    client.from('driver_locations').select('id,driver_id,location,recorded_at').order('recorded_at', { ascending: false }).limit(300),
    client.from('job_bids').select('id,job_id,status,created_at').order('created_at', { ascending: false }).limit(500),
    activeCompanyId ? client.from('notification_events').select('id,event_type,entity_type,entity_id,payload,status,created_at').eq('company_id', activeCompanyId).order('created_at', { ascending: false }).limit(80) : client.from('notification_events').select('id,event_type,entity_type,entity_id,payload,status,created_at').order('created_at', { ascending: false }).limit(80),
    client.from('job_tracking_events').select('id,job_id,event_type,message,created_at,created_by').order('created_at', { ascending: false }).limit(120),
    activeCompanyId ? client.from('invoices').select('id,status,due_date,amount,created_at').eq('company_id', activeCompanyId).order('created_at', { ascending: false }).limit(500) : client.from('invoices').select('id,status,due_date,amount,created_at').order('created_at', { ascending: false }).limit(500),
    client.from('driver_documents').select('id,status,expiry_date,doc_type,created_at').order('created_at', { ascending: false }).limit(250),
    client.from('vehicle_documents').select('id,status,expiry_date,doc_type,created_at').order('created_at', { ascending: false }).limit(250),
  ]);

  if (jobsRes.error) return respond(500, { error: jobsRes.error.message });

  const jobs = ((jobsRes.data ?? []) as JobRow[])
    .filter((job) => {
      const status = norm(job.current_status ?? job.status);
      const haystack = `${job.pickup_location ?? ''} ${job.delivery_location ?? ''} ${job.id}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && liveStatuses.has(status)) ||
        (statusFilter === 'delivered' && completeStatuses.has(status)) ||
        (statusFilter === 'awaiting_pod' && completeStatuses.has(norm(job.status)) && !hasPod(job)) ||
        status === statusFilter;
      const pickup = job.pickup_datetime ?? job.created_at;
      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'today' && sameDay(pickup)) ||
        (dateFilter === 'tomorrow' && sameDay(pickup, new Date(Date.now() + 86400000)));
      return matchesQuery && matchesStatus && matchesDate;
    })
    .sort((a, b) => {
      if (sort === 'time') return new Date(a.pickup_datetime ?? a.created_at ?? 0).getTime() - new Date(b.pickup_datetime ?? b.created_at ?? 0).getTime();
      const priority = (job: JobRow) => (delayedStatuses.has(norm(job.status)) ? 0 : liveStatuses.has(norm(job.status)) ? 1 : 2);
      return priority(a) - priority(b);
    });

  const drivers = (driversRes.data ?? []) as DriverRow[];
  const vehicles = (vehiclesRes.data ?? []) as VehicleRow[];
  const locations = (locationsRes.data ?? []) as DriverLocationRow[];
  const bids = (bidsRes.data ?? []) as BidRow[];
  const notifications = (notificationsRes.data ?? []) as NotificationRow[];
  const tracking = (trackingRes.data ?? []) as TrackingRow[];
  const invoices = (invoicesRes.data ?? []) as Array<{ status: string | null; due_date: string | null; amount: number | string | null; created_at: string | null }>;
  const documents = ([...(driverDocsRes.data ?? []), ...(vehicleDocsRes.data ?? [])] as DocumentRow[]);
  const driversById = new Map(drivers.map((driver) => [driver.id, driver.display_name ?? 'Driver']));
  const vehicleByDriverId = new Map(vehicles.filter((vehicle) => vehicle.assigned_driver_id).map((vehicle) => [vehicle.assigned_driver_id as string, vehicle]));
  const bidsByJob = bids.reduce((map, bid) => map.set(bid.job_id, (map.get(bid.job_id) ?? 0) + 1), new Map<string, number>());
  const latestLocationByDriver = new Map<string, DriverLocationRow>();
  for (const location of locations) {
    if (!driversById.has(location.driver_id)) continue;
    if (!latestLocationByDriver.has(location.driver_id)) latestLocationByDriver.set(location.driver_id, location);
  }

  const todayJobs = jobs.filter((job) => sameDay(job.pickup_datetime ?? job.created_at));
  const activeJobs = jobs.filter((job) => liveStatuses.has(norm(job.current_status ?? job.status)));
  const completedToday = jobs.filter((job) => completeStatuses.has(norm(job.status)) && sameDay(job.updated_at));
  const delayedJobs = jobs.filter((job) => delayedStatuses.has(norm(job.current_status ?? job.status)));
  const podMissingJobs = jobs.filter((job) => completeStatuses.has(norm(job.status)) && job.pod_required !== false && !hasPod(job));
  const awaitingQuote = jobs.filter((job) => ['posted', 'open', 'draft'].includes(norm(job.status)));
  const awaitingCarrier = jobs.filter((job) => !job.awarded_carrier_company_id && ['posted', 'quoted', 'open'].includes(norm(job.status)));
  const onlineDrivers = drivers.filter((driver) => norm(driver.status) === 'active' && norm(driver.availability_status) !== 'offline');
  const availableVehicles = vehicles.filter((vehicle) => !vehicle.assigned_driver_id);
  const pendingInvoices = invoices.filter((invoice) => pendingInvoiceStatuses.has(toCanonicalInvoiceStatusWithDueDate(invoice.status, invoice.due_date)));
  const revenueToday = invoices.filter((invoice) => sameDay(invoice.created_at)).reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
  const monthKey = new Date().toISOString().slice(0, 7);
  const revenueMonth = invoices.filter((invoice) => (invoice.created_at ?? '').startsWith(monthKey)).reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
  const deliveryDurations = jobs.map((job) => minutesBetween(job.pickup_datetime, job.delivery_datetime)).filter((v): v is number => typeof v === 'number');
  const responseDurations = bids.map((bid) => {
    const job = jobs.find((row) => row.id === bid.job_id);
    return minutesBetween(job?.created_at, bid.created_at);
  }).filter((v): v is number => typeof v === 'number');
  const avg = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const expiredDocuments = documents.filter((doc) => doc.expiry_date && new Date(doc.expiry_date).getTime() < Date.now());
  const rejectedDocuments = documents.filter((doc) => ['rejected', 'failed'].includes(norm(doc.status)));
  const healthIssues = [jobsRes.error, driversRes.error, vehiclesRes.error, locationsRes.error, bidsRes.error, notificationsRes.error, trackingRes.error, invoicesRes.error, driverDocsRes.error, vehicleDocsRes.error].filter(Boolean).length;

  const jobCards = activeJobs.slice(0, 80).map((job) => {
    const vehicle = job.assigned_driver_id ? vehicleByDriverId.get(job.assigned_driver_id) : null;
    const currentStatus = norm(job.current_status ?? job.status);
    const next = nextTransition[currentStatus] ?? null;
    return {
      id: job.id,
      shortId: job.id.slice(0, 8).toUpperCase(),
      pickup: job.pickup_location ?? 'Pickup TBC',
      dropoff: job.delivery_location ?? 'Delivery TBC',
      start: formatTime(job.pickup_datetime),
      eta: formatTime(job.delivery_datetime),
      driver: driversById.get(job.assigned_driver_id ?? '') ?? 'Unassigned',
      vehicle: vehicle?.reg_plate ? `${vehicle.type ?? 'Vehicle'} - ${vehicle.reg_plate}` : job.requested_vehicle_type ?? job.vehicle_type ?? 'Vehicle TBC',
      progress: progressForStatus(currentStatus),
      status: statusLabel(currentStatus),
      rawStatus: currentStatus,
      tone: toneForStatus(currentStatus),
      bidCount: bidsByJob.get(job.id) ?? 0,
      priority: delayedStatuses.has(norm(job.status)) ? 'high' : podMissingJobs.some((row) => row.id === job.id) ? 'medium' : 'normal',
      nextStatus: next?.status ?? null,
      nextStatusLabel: next?.label ?? null,
      assignedDriverId: job.assigned_driver_id,
    };
  });

  const mapPoints = [
    ...Array.from(latestLocationByDriver.values()).map((location) => {
      const coordinates = coordinatesFromLocation(location.location);
      return {
        id: location.id,
        kind: 'driver',
        driverId: location.driver_id,
        label: driversById.get(location.driver_id) ?? 'Driver',
        lat: coordinates.lat,
        lng: coordinates.lng,
        status: drivers.find((driver) => driver.id === location.driver_id)?.availability_status ?? 'unknown',
        updatedAt: location.recorded_at,
      };
    }).filter((point) => point.lat !== null && point.lng !== null),
  ];

  const timeline = [
    ...tracking.map((event) => ({
      id: `tracking-${event.id}`,
      time: formatTime(event.created_at),
      title: statusLabel(event.event_type),
      detail: event.message ?? `Job ${event.job_id.slice(0, 8).toUpperCase()}`,
      owner: 'Tracking',
      tone: toneForStatus(event.event_type) === 'red' ? 'red' : toneForStatus(event.event_type) === 'amber' ? 'amber' : 'blue',
      sort: new Date(event.created_at ?? 0).getTime(),
    })),
    ...notifications.map((event) => ({
      id: `notification-${event.id}`,
      time: formatTime(event.created_at),
      title: notificationTitle(event),
      detail: notificationDetail(event),
      owner: 'Notification',
      tone: event.status === 'failed' ? 'red' : 'green',
      sort: new Date(event.created_at ?? 0).getTime(),
    })),
    ...jobs.map((job) => ({
      id: `job-${job.id}`,
      time: formatTime(job.updated_at ?? job.created_at),
      title: statusLabel(job.current_status ?? job.status),
      detail: `${job.pickup_location ?? 'Pickup TBC'} -> ${job.delivery_location ?? 'Delivery TBC'}`,
      owner: driversById.get(job.assigned_driver_id ?? '') ?? 'System',
      tone: toneForStatus(job.current_status ?? job.status) === 'red' ? 'red' : toneForStatus(job.current_status ?? job.status) === 'amber' ? 'amber' : 'blue',
      sort: new Date(job.updated_at ?? job.created_at ?? 0).getTime(),
    })),
  ].sort((a, b) => b.sort - a.sort).slice(0, 80).map(({ sort: _sort, ...item }) => item);

  const alerts = [
    ...delayedJobs.map((job) => ({ id: `delayed-${job.id}`, title: 'Job delayed', message: `${job.pickup_location ?? 'Pickup TBC'} -> ${job.delivery_location ?? 'Delivery TBC'}`, time: relativeTime(job.updated_at), severity: 'critical', type: 'job' })),
    ...podMissingJobs.map((job) => ({ id: `pod-${job.id}`, title: 'POD missing', message: `Delivered job ${job.id.slice(0, 8).toUpperCase()} needs POD`, time: relativeTime(job.updated_at), severity: 'warning', type: 'pod' })),
    ...pendingInvoices.filter((invoice) => toCanonicalInvoiceStatusWithDueDate(invoice.status, invoice.due_date) === 'Overdue').map((invoice, index) => ({ id: `invoice-${index}`, title: 'Invoice overdue', message: `Invoice payment is overdue`, time: relativeTime(invoice.created_at), severity: 'warning', type: 'invoice' })),
    ...expiredDocuments.map((doc) => ({ id: `expired-${doc.id}`, title: 'Document expired', message: doc.doc_type ?? 'Compliance document expired', time: relativeTime(doc.expiry_date), severity: 'critical', type: 'compliance' })),
    ...rejectedDocuments.map((doc) => ({ id: `rejected-${doc.id}`, title: 'Document rejected', message: doc.doc_type ?? 'Compliance document rejected', time: relativeTime(doc.created_at), severity: 'warning', type: 'compliance' })),
    ...drivers.filter((driver) => norm(driver.availability_status) === 'offline').map((driver) => ({ id: `offline-${driver.id}`, title: 'Driver offline', message: `${driver.display_name ?? 'Driver'} is offline`, time: 'now', severity: 'info', type: 'driver' })),
  ].slice(0, 80);

  return respond(200, {
    generatedAt: new Date().toISOString(),
    companyId: activeCompanyId,
    filters: { q: query, status: statusFilter, date: dateFilter, sort },
    metrics: {
      todayJobs: todayJobs.length,
      activeJobs: activeJobs.length,
      completedToday: completedToday.length,
      delayedJobs: delayedJobs.length,
      driversOnline: onlineDrivers.length,
      driversTotal: drivers.length,
      vehiclesAvailable: availableVehicles.length,
      vehiclesTotal: vehicles.length,
      podMissing: podMissingJobs.length,
      invoicesPending: pendingInvoices.length,
      jobsAwaitingQuote: awaitingQuote.length,
      jobsAwaitingCarrier: awaitingCarrier.length,
      companiesOnline: activeCompanyId ? 1 : 0,
      customersOnline: jobs.filter((job) => job.company_id === activeCompanyId).length,
      fleetCompaniesOnline: new Set(jobs.map((job) => job.awarded_carrier_company_id).filter(Boolean)).size,
      ownerDriversOnline: drivers.filter((driver) => norm(driver.availability_status) !== 'offline').length,
      averageDeliveryTimeMinutes: avg(deliveryDurations),
      averageResponseTimeMinutes: avg(responseDurations),
      revenueToday,
      revenueThisMonth: revenueMonth,
      platformHealth: healthIssues === 0 ? 'Operational' : 'Degraded',
    },
    jobs: jobCards,
    mapPoints,
    timeline,
    alerts,
    errors: [driversRes.error, vehiclesRes.error, locationsRes.error, bidsRes.error, notificationsRes.error, trackingRes.error, invoicesRes.error, driverDocsRes.error, vehicleDocsRes.error]
      .filter(Boolean)
      .map((error) => ({ message: error?.message ?? 'Unknown data source error' })),
  });
}
