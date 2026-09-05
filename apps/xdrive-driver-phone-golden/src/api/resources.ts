import { supabase } from '../auth/supabase';
import { apiRequest } from './client';
import type { DriverJob } from '../jobs/types';

type AnyRow = Record<string, any>;

type NearbyJobResponse = {
  jobs: Array<{
    id: string;
    publicReference: string | null;
    poster?: { name: string | null; memberCode: string | null };
    pickup: { addressSummary: string; collectionFrom: string | null };
    delivery: { addressSummary: string; deliveryFrom: string | null };
    vehicleType: string | null;
    freightType: string | null;
    pallets: number | null;
    weightKg: number | null;
    publicPrice: { visible: boolean; amount: number | null; currency: string | null };
  }>;
};

export type DriverProfileResource = {
  email: string;
  name?: string;
  phone?: string;
  role?: string;
  driver?: AnyRow | null;
  company?: AnyRow | null;
  vehicle?: AnyRow | null;
  documents: AnyRow[];
  invoices: AnyRow[];
  alerts: AnyRow[];
  quotes: AnyRow[];
};

export type ReturnIqMeta = {
  active: boolean;
  destinationArea?: string;
  currentJobReference?: string;
  availableAfter?: string | null;
  radiusMiles?: number;
  reason?: string;
};

const jobSelect = [
  'id',
  'company_id',
  'booked_by_company_name',
  'status',
  'current_status',
  'vehicle_type',
  'requested_vehicle_type',
  'requested_vehicle_label',
  'cargo_type',
  'requested_cargo_label',
  'pickup_location',
  'pickup_postcode',
  'pickup_datetime',
  'pickup_time_slot',
  'delivery_location',
  'delivery_postcode',
  'delivery_time_slot',
  'weight_kg',
  'pallets',
  'budget_amount',
  'agreed_rate',
  'agreed_rate_gbp',
  'is_fixed_price',
  'currency',
  'exchange_posted_at',
  'awarded_carrier_company_id',
  'assigned_company_id',
  'assigned_driver_id',
  'direct_invite_company_id',
  'collection_contact_name',
  'collection_contact_phone',
  'delivery_contact_name',
  'delivery_contact_phone',
  'client_name',
  'client_phone',
  'load_details',
  'special_requirements',
  'access_restrictions',
  'pod_required',
  'created_at',
  'updated_at',
].join(',');

// Quote/marketplace reads must never download street addresses or contacts for
// a driver who has not been allocated the job. This is intentionally a separate
// projection rather than a UI-only mask.
const publicJobSelect = [
  'id',
  'company_id',
  'booked_by_company_name',
  'status',
  'current_status',
  'vehicle_type',
  'requested_vehicle_type',
  'requested_vehicle_label',
  'cargo_type',
  'requested_cargo_label',
  'pickup_postcode',
  'pickup_datetime',
  'pickup_time_slot',
  'delivery_postcode',
  'delivery_time_slot',
  'weight_kg',
  'pallets',
  'budget_amount',
  'is_fixed_price',
  'currency',
  'exchange_posted_at',
  'assigned_driver_id',
  'created_at',
  'updated_at',
].join(',');

async function authUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Driver session not found.');
  return data.user;
}

function money(value: unknown, currency = 'GBP') {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function publicArea(postcode: unknown) {
  const value = String(postcode ?? '').trim().toUpperCase();
  if (!value) return 'Area disclosed after allocation';
  const outwardCode = value.split(/\s+/)[0];
  return `Approx. area · ${outwardCode}`;
}

function publicAreaFromSummary(summary: unknown) {
  const value = String(summary ?? '').trim().toUpperCase();
  if (!value) return 'Area disclosed after allocation';
  const fullPostcode = value.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/);
  if (fullPostcode) return `Approx. area · ${fullPostcode[1]}`;
  const outwardAtEnd = value.match(/\b([A-Z]{1,2}\d[A-Z\d]?)$/);
  if (outwardAtEnd) {
    const prefix = value.slice(0, outwardAtEnd.index).replace(/[\s,·-]+$/, '').trim();
    const safeTown = prefix && !/\d/.test(prefix) && prefix.length <= 40 ? `${prefix} · ` : 'Approx. area · ';
    return `${safeTown}${outwardAtEnd[1]}`;
  }
  return !/\d|,/.test(value) && value.length <= 40 ? value : 'Area disclosed after allocation';
}

export function mapResourceJob(row: AnyRow, showPublicPrice = false, revealPrivateDetails = false): DriverJob {
  return {
    id: String(row.id),
    reference: `XDL-${String(row.id).slice(0, 8).toUpperCase()}`,
    postingCompanyName: row.posting_company_name || row.poster_company_name || row.booked_by_company_name || undefined,
    postingCompanyMemberCode: row.posting_company_member_code || undefined,
    status: mapJobStatus(row.current_status || row.status, row.status_history),
    pickupLocation: revealPrivateDetails ? (row.pickup_location || row.pickup_postcode || 'Pickup not set') : publicArea(row.pickup_postcode),
    deliveryLocation: revealPrivateDetails ? (row.delivery_location || row.delivery_postcode || 'Delivery not set') : publicArea(row.delivery_postcode),
    pickupTime: row.pickup_datetime || row.pickup_time_slot || 'Collection time not set',
    deliveryTime: row.delivery_datetime || row.delivery_time_slot || 'Delivery time not set',
    cargoType: row.requested_cargo_label || row.cargo_type || 'Cargo not set',
    vehicleRequirement: row.requested_vehicle_label || row.requested_vehicle_type || row.vehicle_type || 'Vehicle not set',
    price: showPublicPrice ? money(row.budget_amount, row.currency) : '',
    priority: 'normal',
    podRequired: true,
    contactAllowed: revealPrivateDetails && Boolean(row.delivery_contact_phone || row.collection_contact_phone || row.client_phone),
    contactName: revealPrivateDetails ? (row.delivery_contact_name || row.collection_contact_name || row.client_name || undefined) : undefined,
    contactPhone: revealPrivateDetails ? (row.delivery_contact_phone || row.collection_contact_phone || row.client_phone || undefined) : undefined,
    publicPricePublished: showPublicPrice,
    canViewPrice: showPublicPrice,
    privateDetailsRevealed: revealPrivateDetails,
  };
}

function mapJobStatus(value: unknown, rawHistory?: unknown): DriverJob['status'] {
  const history = Array.isArray(rawHistory) ? rawHistory : [];
  const events = new Set(history.map((entry) => String(entry?.status ?? '')));
  if (events.has('delivered')) return 'delivered';
  if (events.has('arrived_delivery')) return 'arrived_delivery';
  if (events.has('in_transit')) return 'on_my_way_delivery';
  if (events.has('collected')) return 'loaded';
  if (events.has('arrived_pickup')) return 'arrived_pickup';
  if (events.has('driver_en_route')) return 'on_my_way_pickup';
  const status = String(value || 'awarded').toLowerCase();
  if (status === 'posted') return 'awarded';
  if (status === 'allocated') return 'awarded';
  if (status === 'on_my_way') return 'on_my_way_pickup';
  if (status === 'on_site_pickup') return 'arrived_pickup';
  if (status === 'in_transit') return 'on_my_way_delivery';
  if (status === 'on_site_delivery') return 'arrived_delivery';
  if (['awarded', 'on_my_way_pickup', 'arrived_pickup', 'loaded', 'on_my_way_delivery', 'arrived_delivery', 'delivered'].includes(status)) {
    return status as DriverJob['status'];
  }
  return 'awarded';
}

function publicPriceVisible(row: AnyRow) {
  return row.is_fixed_price === true && row.budget_amount != null;
}

async function fetchDriverQuotes(userId: string, driverId: string | null, companyId: string | null) {
  let query = supabase
    .from('job_bids')
    .select('id,job_id,status,amount,bid_price_gbp,currency,message,created_at,bidder_user_id,bidder_driver_id,company_id')
    .order('created_at', { ascending: false })
    .limit(50);

  const filters = [`bidder_user_id.eq.${userId}`];
  if (driverId) filters.push(`bidder_driver_id.eq.${driverId}`);
  query = query.or(filters.join(','));

  const { data: bids, error } = await query;
  if (error) throw new Error(error.message);
  const rows = bids ?? [];
  const jobIds = [...new Set(rows.map((row) => row.job_id).filter(Boolean))];
  if (jobIds.length === 0) return rows;

  const { data: publicQuoteJobs, error: jobsError } = await supabase
    .from('jobs')
    .select(publicJobSelect)
    .in('id', jobIds);
  if (jobsError) throw new Error(jobsError.message);

  const assignedIds = ((publicQuoteJobs ?? []) as AnyRow[])
    .filter((row) => driverId && row.assigned_driver_id === driverId)
    .map((row) => row.id);
  let assignedJobs: AnyRow[] = [];
  if (assignedIds.length > 0) {
    const { data, error: assignedError } = await supabase.from('jobs').select(jobSelect).in('id', assignedIds);
    if (assignedError) throw new Error(assignedError.message);
    assignedJobs = (data ?? []) as AnyRow[];
  }

  const jobsById = new Map(((publicQuoteJobs ?? []) as AnyRow[]).map((row) => [String(row.id), row]));
  for (const row of assignedJobs) jobsById.set(String(row.id), row);
  return rows.map((row) => {
    const job = jobsById.get(String(row.job_id)) ?? null;
    return {
      ...row,
      job: job ? { ...job, private_details_revealed: Boolean(driverId && job.assigned_driver_id === driverId) } : null,
    };
  });
}

function mapNearbyApiJob(row: NearbyJobResponse['jobs'][number]): DriverJob {
  const showPublicPrice = row.publicPrice.visible === true && row.publicPrice.amount != null;
  const loadParts = [
    row.freightType,
    row.pallets != null ? `${row.pallets} pallet${row.pallets === 1 ? '' : 's'}` : null,
    row.weightKg != null ? `${row.weightKg} kg` : null,
  ].filter(Boolean);

  return {
    id: row.id,
    reference: row.publicReference || `XDL-${row.id.slice(0, 8).toUpperCase()}`,
    postingCompanyName: row.poster?.name || undefined,
    postingCompanyMemberCode: row.poster?.memberCode || undefined,
    status: 'awarded',
    pickupLocation: publicAreaFromSummary(row.pickup.addressSummary),
    deliveryLocation: publicAreaFromSummary(row.delivery.addressSummary),
    pickupTime: row.pickup.collectionFrom || 'Collection time not set',
    deliveryTime: row.delivery.deliveryFrom || 'Delivery time not set',
    cargoType: loadParts.join(' · ') || 'Cargo not set',
    vehicleRequirement: row.vehicleType || 'Vehicle not set',
    price: showPublicPrice ? money(row.publicPrice.amount, row.publicPrice.currency || 'GBP') : '',
    priority: 'normal',
    podRequired: true,
    contactAllowed: false,
    publicPricePublished: showPublicPrice,
    canViewPrice: showPublicPrice,
    privateDetailsRevealed: false,
  };
}

export async function submitJobQuote({ jobId, amount, message }: { jobId: string; amount: number; message?: string }) {
  await apiRequest('/api/driver/mobile/bids', {
    method: 'POST',
    body: { jobId, amount, message: message?.trim() || '' },
  });
}

export async function fetchMarketplaceJobs(): Promise<DriverJob[]> {
  try {
    const response = await apiRequest<NearbyJobResponse>('/api/driver/mobile/nearby-jobs');
    return response.jobs.map(mapNearbyApiJob);
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes('HTTP 404')) throw error;
  }

  return fetchMarketplaceJobsDirect();
}

async function fetchMarketplaceJobsDirect(): Promise<DriverJob[]> {
  const user = await authUser();
  const { data: driver } = await supabase.from('drivers').select('id, company_id').eq('user_id', user.id).maybeSingle();
  const companyId = driver?.company_id;
  let query = supabase
    .from('jobs')
    .select(publicJobSelect)
    .eq('status', 'posted')
    .is('awarded_carrier_company_id', null)
    .order('exchange_posted_at', { ascending: false })
    .limit(100);

  if (companyId) {
    query = query
      .or(`exchange_visibility.eq.exchange,and(exchange_visibility.eq.direct,direct_invite_company_id.eq.${companyId})`)
      .neq('company_id', companyId);
  } else {
    query = query.eq('exchange_visibility', 'exchange');
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AnyRow[];
  const postingCompanyIds = [...new Set(rows.map((row) => row.company_id).filter(Boolean).map(String))];
  let postingCompanies = new Map<string, AnyRow>();
  if (postingCompanyIds.length > 0) {
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id,name,company_number')
      .in('id', postingCompanyIds);
    if (!companiesError) postingCompanies = new Map(((companies ?? []) as AnyRow[]).map((company) => [String(company.id), company]));
  }
  return rows.map((row) => {
    const postingCompany = postingCompanies.get(String(row.company_id));
    return mapResourceJob({
      ...row,
      posting_company_name: postingCompany?.name ?? row.booked_by_company_name ?? null,
      posting_company_member_code: postingCompany?.company_number ?? null,
    }, publicPriceVisible(row), false);
  });
}

export async function fetchDestinationMarketplaceJobs(radius: 10 | 20 | 30 = 10) {
  try {
    const response = await apiRequest<NearbyJobResponse & { returnIq?: ReturnIqMeta }>(`/api/driver/mobile/nearby-jobs?mode=destination&radius=${radius}`);
    return { jobs: response.jobs.map(mapNearbyApiJob), meta: response.returnIq ?? { active: false } };
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes('HTTP 404')) throw error;
  }
  return {
    jobs: await fetchMarketplaceJobsDirect(),
    meta: { active: false, reason: 'Destination priority will activate when the updated server route is published.' } as ReturnIqMeta,
  };
}

export async function updateJobQuote({ bidId, amount, message }: { bidId: string; amount: number; message?: string }) {
  const user = await authUser();
  const { data, error } = await supabase
    .from('job_bids')
    .update({ amount, bid_price_gbp: amount, message: message?.trim() || null })
    .eq('id', bidId)
    .eq('bidder_user_id', user.id)
    .eq('status', 'submitted')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('This quote can no longer be edited. Refresh Quotes to see its current status.');
}

export async function withdrawJobQuote(bidId: string) {
  const user = await authUser();
  const { data, error } = await supabase
    .from('job_bids')
    .update({ status: 'withdrawn' })
    .eq('id', bidId)
    .eq('bidder_user_id', user.id)
    .eq('status', 'submitted')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Withdrawal is unavailable because this quote is no longer active.');
}

export async function updateDriverAvailability(availabilityStatus: 'available' | 'busy' | 'offline') {
  const user = await authUser();
  const { data, error } = await supabase
    .from('drivers')
    .update({ availability_status: availabilityStatus })
    .eq('user_id', user.id)
    .select('id,availability_status')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Driver availability could not be updated for this account.');
  return data;
}

export async function updateDestinationPreferences(enabled: boolean, radiusMiles: 10 | 20 | 30) {
  const user = await authUser();
  const { data, error } = await supabase
    .from('drivers')
    .update({ destination_priority_enabled: enabled, destination_radius_miles: radiusMiles })
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Destination preferences could not be updated for this account.');
  return { ok: true as const };
}

export async function createSupportTicket(input: { subject: string; description: string }) {
  return apiRequest<{ ticket: AnyRow }>('/api/support/tickets', {
    method: 'POST',
    body: { ...input, category: 'technical', priority: 'medium' },
  });
}

export async function uploadDriverDocument(input: { docType: string; fileName: string; mimeType: string; base64: string }) {
  try {
    return await apiRequest<{ ok: true }>('/api/driver/mobile/resources', {
      method: 'POST',
      body: { action: 'upload_document', ...input },
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('HTTP 404')) throw error;
  }

  const user = await authUser();
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('id,company_id,status,app_access')
    .eq('user_id', user.id)
    .maybeSingle();
  if (driverError) throw new Error(driverError.message);
  if (!driver?.id || !driver.company_id || driver.app_access === false || String(driver.status ?? 'active').toLowerCase() !== 'active') {
    throw new Error('This driver account is not currently active.');
  }

  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(input.mimeType)) {
    throw new Error('Use a PDF, JPG, PNG or WEBP document.');
  }
  const binary = globalThis.atob(input.base64);
  if (!binary.length || binary.length > 10 * 1024 * 1024) throw new Error('Document must be smaller than 10 MB.');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160) || 'document';
  const path = `${driver.company_id}/${driver.id}/${Date.now()}-${safeName}`;
  const { error: storageError } = await supabase.storage.from('driver-docs').upload(path, bytes.buffer, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (storageError) throw new Error(storageError.message);
  const { error: insertError } = await supabase.from('driver_documents').insert({
    driver_id: driver.id,
    doc_type: input.docType,
    file_path: path,
    status: 'pending',
  });
  if (insertError) {
    await supabase.storage.from('driver-docs').remove([path]);
    throw new Error(insertError.message);
  }
  return { ok: true as const };
}

export async function fetchDriverResources(): Promise<DriverProfileResource> {
  try {
    const response = await apiRequest<{ resources: DriverProfileResource }>('/api/driver/mobile/resources');
    return response.resources;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('HTTP 404')) throw error;
  }

  const user = await authUser();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id,full_name,phone,role,company_id,is_driver,status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('id,company_id,user_id,display_name,phone,email,status,app_access,availability_status,last_app_login,created_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (driverError) throw new Error(driverError.message);

  const companyId = driver?.company_id ?? profile?.company_id ?? null;
  const driverId = driver?.id ?? null;

  const [companyResult, vehicleResult, driverDocsResult, vehicleDocsResult, invoicesResult, alertsResult, marketplaceAlertsResult, quotes] = await Promise.all([
    companyId ? supabase.from('companies').select('id,name,email,phone,city,postcode,country,status,company_type').eq('id', companyId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    driverId ? supabase.from('vehicles').select('id,type,vehicle_type,reg_plate,make,model,payload_kg,pallets_capacity,equipment,internal_length_m,internal_width_m,internal_height_m,has_tail_lift,has_straps,has_blankets').eq('assigned_driver_id', driverId).limit(1) : Promise.resolve({ data: [], error: null }),
    driverId ? supabase.from('driver_documents').select('id,doc_type,file_path,issued_date,expiry_date,status,created_at').eq('driver_id', driverId).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    driverId ? supabase.from('vehicle_documents').select('id,vehicle_id,doc_type,file_path,issued_date,expiry_date,status,created_at').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    companyId ? supabase.from('invoices').select('id,invoice_number,job_id,invoice_date,due_date,status,client_name,amount,currency,payment_status,created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    companyId ? supabase.from('notification_events').select('id,event_type,entity_type,entity_id,payload,status,created_at,recipient_user_id,company_id').or(`recipient_user_id.eq.${user.id},company_id.eq.${companyId}`).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    companyId ? supabase.from('jobs').select('id,pickup_postcode,delivery_postcode,requested_vehicle_label,vehicle_type,exchange_posted_at').eq('status', 'posted').eq('exchange_visibility', 'exchange').neq('company_id', companyId).order('exchange_posted_at', { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
    fetchDriverQuotes(user.id, driverId, companyId),
  ]);

  const firstError = [companyResult, vehicleResult, driverDocsResult, vehicleDocsResult, invoicesResult, alertsResult, marketplaceAlertsResult].find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const marketplaceAlerts = ((marketplaceAlertsResult.data ?? []) as AnyRow[]).map((row) => ({
    id: `market-${row.id}`,
    event_type: 'new_job_posted',
    entity_type: 'job',
    entity_id: row.id,
    status: 'in_app',
    created_at: row.exchange_posted_at,
    payload: {
      job_reference: `XDL-${String(row.id).slice(0, 8).toUpperCase()}`,
      pickup_area: publicArea(row.pickup_postcode),
      delivery_area: publicArea(row.delivery_postcode),
      vehicle: row.requested_vehicle_label || row.vehicle_type || 'Vehicle not set',
    },
  }));

  return {
    email: driver?.email || user.email || '',
    name: profile?.full_name || driver?.display_name || undefined,
    phone: profile?.phone || driver?.phone || undefined,
    role: profile?.role || undefined,
    driver,
    company: companyResult.data ?? null,
    vehicle: Array.isArray(vehicleResult.data) ? vehicleResult.data[0] ?? null : null,
    documents: [...(driverDocsResult.data ?? []), ...(vehicleDocsResult.data ?? [])],
    invoices: invoicesResult.data ?? [],
    alerts: [...marketplaceAlerts, ...(alertsResult.data ?? [])].sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''))),
    quotes,
  };
}

export async function fetchAssignedJobsDirect(scope: 'active' | 'upcoming' | 'completed'): Promise<DriverJob[]> {
  const user = await authUser();
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (driverError) throw new Error(driverError.message);
  if (!driver?.id) return [];

  const statuses = scope === 'completed' ? ['delivered'] : scope === 'upcoming' ? ['allocated'] : ['allocated', 'collected', 'in_transit'];
  const { data, error } = await supabase
    .from('jobs')
    .select(jobSelect)
    .eq('assigned_driver_id', driver.id)
    .in('status', statuses)
    .order('pickup_datetime', { ascending: scope !== 'completed' })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as AnyRow[]).map((row) => ({
    ...mapResourceJob(row, true, true),
    canUpdateLifecycle: String(row.status ?? '').toLowerCase() !== 'delivered',
    privateDetailsRevealed: true,
  }));
}

export function formatMoney(value: unknown, currency = 'GBP') {
  return money(value, currency);
}
