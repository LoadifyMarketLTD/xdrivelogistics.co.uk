// Production driver API adapter. Only publishable Supabase keys are accepted.
const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
type Json = Record<string, unknown>;
export type LiveSession = { token: string; refreshToken: string; expiresAt: number };
export type LiveStopHandover = {
  version?: number;
  capturedAt?: string | null;
  customerReference?: string | null;
  itemCount?: number | null;
  packaging?: string | null;
  weightKg?: number | null;
  etaAt?: string | null;
  etaMinutes?: number | null;
  notes?: string | null;
  recipientName?: string | null;
  leftAt?: string | null;
  deliveryStatus?: string | null;
  deliveredOn?: string | null;
  photoPaths?: string[];
  documentPaths?: string[];
  signaturePath?: string | null;
};
export type LiveStop = {
  id: string;
  type: 'collection' | 'delivery';
  sequence: number;
  address: string;
  company?: string;
  contactPerson?: string;
  telephone?: string;
  timeWindowFrom?: string;
  timeWindowTo?: string;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  notes?: string;
  arrivedAt?: string;
  completedAt?: string;
  handover?: LiveStopHandover | null;
};
export type LiveJob = {
  id: string; from: string; to: string; pickup: string; delivery: string;
  vehicle: string; weight: number; notes: string; status: 'OPEN' | 'ALLOCATED' | 'ON_WAY_TO_PICKUP' | 'ON_SITE_PICKUP' | 'LOADED' | 'ON_WAY_TO_DELIVERY' | 'ON_SITE_DELIVERY' | 'POD_SUBMITTED' | 'DELIVERED';
  company?: string; terms?: string; postedAt?: string; distanceMiles?: number; travelMinutes?: number;
  quote?: number; quoteSubmittedAt?: string; quoteOutcome?: 'UNSUCCESSFUL' | 'CANCELLED' | 'AWARDED';
  offerId?: string; acceptanceRequired?: boolean; backendStatus?: string; podRecorded?: boolean;
  pickupDate?: string; deliveryDate?: string; pickupAddress?: string; deliveryAddress?: string;
  customerRef?: string; yourRef?: string; service?: string;
  items?: number; hardCopyPodRequired?: boolean;
  stops?: number; routeStops?: LiveStop[];
};
const obj = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const str = (value: unknown): string => typeof value === 'string' ? value : '';
const num = (value: unknown): number | undefined => value == null || value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);
const dateTime = (value: unknown): string => {
  const raw = str(value);
  if (!raw) return 'Not provided';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
};
const date = (value: unknown): string => {
  const raw = str(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
};
const get = (row: Json, ...keys: string[]): unknown => keys.map(k => row[k]).find(v => v !== null && v !== undefined && v !== '');
async function jsonFetch(url: string, init?: RequestInit): Promise<Json> {
  const response = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(45000), headers: { Accept: 'application/json', ...init?.headers }, cache: 'no-store' });
  const body = obj(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(str(body.error_description) || str(body.msg) || str(body.error) || 'API request failed (' + response.status + ')');
  return body;
}
export async function login(email: string, password: string): Promise<LiveSession> {
  const config = await jsonFetch(base + '/mobile/config');
  const url = str(config.supabaseUrl);
  const key = str(config.supabaseAnonKey);
  if (url !== 'https://jqxlauexhkonixtjvljw.supabase.co' || !key) throw new Error('LIVE authentication configuration mismatch');
  const auth = await jsonFetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const token = str(auth.access_token);
  if (!token) throw new Error('No access token returned');
  latestSession = { token, refreshToken: str(auth.refresh_token), expiresAt: Date.now() + (num(auth.expires_in) || 3600) * 1000 };
  return latestSession;
}
let latestSession: LiveSession | null = null;
let renewalInFlight: Promise<LiveSession> | null = null;
export async function renewSession(session: LiveSession): Promise<LiveSession> {
  const current = latestSession && latestSession.expiresAt > session.expiresAt ? latestSession : session;
  if (current.expiresAt > Date.now() + 120000) return current;
  if (renewalInFlight) return renewalInFlight;
  renewalInFlight = renewSessionOnce(current).then(next => { latestSession = next; return next; }).finally(() => { renewalInFlight = null; });
  return renewalInFlight;
}
async function renewSessionOnce(session: LiveSession): Promise<LiveSession> {
  if (!session.refreshToken) throw new Error('Session expired. Please sign in again.');
  const config = await jsonFetch(base + '/mobile/config');
  const url = str(config.supabaseUrl);
  const key = str(config.supabaseAnonKey);
  if (url !== 'https://jqxlauexhkonixtjvljw.supabase.co' || !key) throw new Error('LIVE authentication configuration mismatch');
  let auth: Json;
  try {
    auth = await jsonFetch(url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session renewal failed';
    if (/400|invalid.grant|refresh.token|already.used|session.expired/i.test(message)) throw new Error('Session expired. Please sign in again.');
    throw error;
  }
  const token = str(auth.access_token);
  if (!token) throw new Error('Session renewal failed');
  return {
    token,
    refreshToken: str(auth.refresh_token) || session.refreshToken,
    expiresAt: Date.now() + (num(auth.expires_in) || 3600) * 1000,
  };
}
export async function revokeLiveSession(session: LiveSession): Promise<void> {
  const config = await jsonFetch(base + '/mobile/config');
  const url = str(config.supabaseUrl);
  const key = str(config.supabaseAnonKey);
  if (url !== 'https://jqxlauexhkonixtjvljw.supabase.co' || !key) throw new Error('LIVE authentication configuration mismatch');
  const response = await fetch(url + '/auth/v1/logout', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + session.token } });
  if (!response.ok && response.status !== 401) throw new Error('Server session revocation failed (' + response.status + ')');
}
export async function bookingOffersGet(token: string): Promise<Json> {
  return jsonFetch(import.meta.env.PROD ? '/api/booking-offers' : '/xdrive-api/booking-offers', { headers: { Authorization: 'Bearer ' + token } });
}
export async function bookingOfferRespond(token: string, offerId: string, action: 'accept' | 'decline'): Promise<Json> {
  return jsonFetch((import.meta.env.PROD ? '/api/booking-offers/' : '/xdrive-api/booking-offers/') + encodeURIComponent(offerId) + '/respond', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
}
export async function driverGet(path: string, token: string): Promise<Json> {
  if (!token) throw new Error('Driver authentication required');
  return jsonFetch(base + path, { headers: { Authorization: 'Bearer ' + token } });
}
export async function driverPost(path: string, token: string, body: Json): Promise<Json> {
  if (!token) throw new Error('Driver authentication required');
  return jsonFetch(base + path, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
export function mapMarketplace(raw: unknown): LiveJob {
  const r = obj(raw); const member = obj(r.member); const bid = obj(r.myBid);
  const bidAmount = num(bid.amount);
  const status = str(bid.status).toLowerCase();
  return {
    id: str(r.id), from: str(get(r, 'pickup_area', 'pickup_postcode_area')) || 'Collection area',
    to: str(get(r, 'delivery_area', 'delivery_postcode_area')) || 'Delivery area',
    pickup: dateTime(r.pickup_datetime) !== 'Not provided' ? dateTime(r.pickup_datetime) : (str(r.pickup_time_slot) || 'Collection time TBC'), delivery: dateTime(r.delivery_datetime) !== 'Not provided' ? dateTime(r.delivery_datetime) : (str(r.delivery_time_slot) || 'Delivery time TBC'),
    pickupDate: date(r.pickup_datetime), deliveryDate: date(r.delivery_datetime),
    vehicle: str(get(r, 'requested_vehicle_label', 'requested_vehicle_type', 'vehicle_type')) || 'Not provided',
    weight: num(r.weight_kg) || 0, notes: str(r.public_quote_notes),
    status: 'OPEN', company: str(member.name) || 'Marketplace member',
    terms: str(r.payment_terms) || 'Not provided',
    postedAt: dateTime(r.exchange_posted_at),
    distanceMiles: num(r.distance_miles), travelMinutes: num(r.distance_minutes),
    service: str(r.service_mode) || 'Not provided',
    ...(bidAmount !== undefined ? { quote: bidAmount, quoteOutcome: status === 'accepted' ? 'AWARDED' as const : status === 'cancelled' ? 'CANCELLED' as const : undefined } : {}),
  };
}
function cleanDetails(raw: unknown): { notes: string; simulated: boolean } {
  const source = str(raw).trim();
  if (!source) return { notes: '', simulated: false };
  let detail: Json = {};
  try { detail = obj(JSON.parse(source)); } catch {
    return { notes: source, simulated: /SIMULATED TEST JOB ONLY|NO REAL GOODS|DO NOT DISPATCH/i.test(source) };
  }
  const notes = [detail.publicQuoteNotes, detail.executionInstructions, detail.notes, detail.operationalDetails]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0).join(' | ');
  const simulated = /SIMULATED TEST JOB ONLY|NO REAL GOODS|DO NOT DISPATCH|AUTOMATED PLATFORM TEST/i.test(source);
  return { notes, simulated };
}
export function isSimulatedLiveJob(raw: unknown): boolean {
  const r = obj(raw);
  return cleanDetails(get(r, 'loadDetails', 'load_details')).simulated;
}
const statusMap: Record<string, LiveJob['status']> = {
  allocated: 'ALLOCATED', assigned: 'ALLOCATED', accepted: 'ALLOCATED',
  on_my_way: 'ON_WAY_TO_PICKUP', on_my_way_pickup: 'ON_WAY_TO_PICKUP', on_way_to_pickup: 'ON_WAY_TO_PICKUP',
  on_site_pickup: 'ON_SITE_PICKUP', arrived_pickup: 'ON_SITE_PICKUP',
  loaded: 'LOADED', in_transit: 'ON_WAY_TO_DELIVERY', on_my_way_delivery: 'ON_WAY_TO_DELIVERY', on_way_to_delivery: 'ON_WAY_TO_DELIVERY',
  on_site_delivery: 'ON_SITE_DELIVERY', arrived_delivery: 'ON_SITE_DELIVERY', pod_submitted: 'POD_SUBMITTED',
  delivered: 'DELIVERED', completed: 'DELIVERED',
};
function mapAssignedStop(raw: unknown): LiveStop | null {
  const r = obj(raw);
  const id = str(r.id);
  const type = str(r.type).toLowerCase();
  const sequence = num(r.sequence);
  const address = str(r.address);
  if (!id || (type !== 'collection' && type !== 'delivery') || sequence === undefined || !address) return null;
  const statusRaw = str(r.status).toLowerCase();
  const status: LiveStop['status'] = statusRaw === 'arrived' || statusRaw === 'completed' || statusRaw === 'skipped' ? statusRaw : 'pending';
  const handoverRaw = obj(r.handover);
  const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
  const handover: LiveStopHandover | null = Object.keys(handoverRaw).length ? {
    version: num(handoverRaw.version),
    capturedAt: str(handoverRaw.capturedAt) || null,
    customerReference: str(handoverRaw.customerReference) || null,
    itemCount: num(handoverRaw.itemCount) ?? null,
    packaging: str(handoverRaw.packaging) || null,
    weightKg: num(handoverRaw.weightKg) ?? null,
    etaAt: str(handoverRaw.etaAt) || null,
    etaMinutes: num(handoverRaw.etaMinutes) ?? null,
    notes: str(handoverRaw.notes) || null,
    recipientName: str(handoverRaw.recipientName) || null,
    leftAt: str(handoverRaw.leftAt) || null,
    deliveryStatus: str(handoverRaw.deliveryStatus) || null,
    deliveredOn: str(handoverRaw.deliveredOn) || null,
    photoPaths: stringArray(handoverRaw.photoPaths),
    documentPaths: stringArray(handoverRaw.documentPaths),
    signaturePath: str(handoverRaw.signaturePath) || null,
  } : null;
  return {
    id, type, sequence, address, status,
    company: str(r.company) || undefined,
    contactPerson: str(r.contactPerson) || undefined,
    telephone: str(r.telephone) || undefined,
    timeWindowFrom: str(r.timeWindowFrom) || undefined,
    timeWindowTo: str(r.timeWindowTo) || undefined,
    notes: str(r.notes) || undefined,
    arrivedAt: str(r.arrivedAt) || undefined,
    completedAt: str(r.completedAt) || undefined,
    handover,
  };
}
export function mapAssigned(raw: unknown): LiveJob {
  const r = obj(raw); const details = cleanDetails(get(r, 'loadDetails', 'load_details'));
  const canonicalStatus = str(get(r, 'currentStatus', 'current_status', 'lifecycleStatus', 'lifecycle_status', 'status')).toLowerCase();
  const routeStops = Array.isArray(r.stops) ? r.stops.map(mapAssignedStop).filter((stop): stop is LiveStop => Boolean(stop)).sort((a, b) => a.sequence - b.sequence) : [];
  return {
    id: str(r.id), from: str(get(r, 'pickupLocation', 'pickup_location', 'pickupPostcode', 'pickup_postcode')) || 'Collection',
    to: str(get(r, 'deliveryLocation', 'delivery_location', 'deliveryPostcode', 'delivery_postcode')) || 'Delivery',
    pickup: dateTime(get(r, 'pickupTime', 'pickupDatetime', 'pickup_datetime')),
    delivery: dateTime(get(r, 'deliveryTime', 'deliveryDatetime', 'delivery_datetime')),
    pickupDate: date(get(r, 'pickupTime', 'pickupDatetime', 'pickup_datetime')),
    deliveryDate: date(get(r, 'deliveryTime', 'deliveryDatetime', 'delivery_datetime')),
    vehicle: str(get(r, 'vehicleRequirement', 'vehicleType', 'vehicle_type')) || 'Not provided',
    weight: num(get(r, 'weightKg', 'weight_kg')) || 0,
    items: num(get(r, 'itemCount', 'no_of_items')),
    hardCopyPodRequired: /^(required|yes|true|1)$/i.test(str(get(r, 'hardCopyPod', 'hard_copy_pod'))) || get(r, 'hardCopyPodRequired') === true,
    notes: details.notes || str(get(r, 'collectionNotes', 'driverNotes', 'driver_notes')),
    status: statusMap[canonicalStatus] || 'ALLOCATED', backendStatus: canonicalStatus, podRecorded: r.podGenerated === true || Boolean(r.deliverySignatureData),
    company: str(get(r, 'companyName', 'clientName', 'client_name')) || 'Customer not provided',
    terms: str(get(r, 'paymentTerms', 'payment_terms')) || 'Not provided',
    postedAt: dateTime(get(r, 'exchangePostedAt', 'exchange_posted_at', 'createdAt', 'created_at', 'updatedAt')),
    distanceMiles: num(get(r, 'distanceMiles', 'distance_miles')),
    travelMinutes: num(get(r, 'distanceMinutes', 'distance_minutes')),
    quote: num(get(r, 'agreedRateAmount', 'price')),
    quoteOutcome: 'AWARDED',
    pickupAddress: str(get(r, 'pickupAddress', 'pickup_address')),
    deliveryAddress: str(get(r, 'deliveryAddress', 'delivery_address')),
    customerRef: str(get(r, 'customerReference', 'customer_reference')),
    yourRef: str(get(r, 'reference', 'driverReference', 'driver_reference')) || str(r.id),
    stops: routeStops.length,
    routeStops,
  };
}
export async function loadLive(token: string): Promise<LiveJob[]> {
  return (await loadLiveWithDiagnostics(token)).jobs;
}
export async function loadLiveWithDiagnostics(token: string, onProgress?: (snapshot: {jobs: LiveJob[]; warnings: string[]; bookingsPending: boolean}) => void): Promise<{jobs: LiveJob[]; warnings: string[]}> {
  const feeds = [
    driverGet('/marketplace/loads', token),
    driverGet('/mobile/jobs?scope=bookings', token),
    driverGet('/mobile/jobs?scope=completed', token),
    driverGet('/mobile/bids', token),
    bookingOffersGet(token),
  ];
  const partial: PromiseSettledResult<Json>[] = Array.from({ length: feeds.length }, () => ({ status: 'rejected', reason: new Error('Pending') }));
  const settled = Array(feeds.length).fill(false);
  const responses = await Promise.all(feeds.map((feed, index) => Promise.resolve(feed).then(value => {
    partial[index] = { status: 'fulfilled', value };
    settled[index] = true;
    if (onProgress) onProgress({ ...mergeLiveResponses(partial), bookingsPending: ![1, 2, 4].every(i => settled[i]) });
    return { status: 'fulfilled', value } as PromiseFulfilledResult<Json>;
  }, reason => {
    partial[index] = { status: 'rejected', reason };
    settled[index] = true;
    if (onProgress) onProgress({ ...mergeLiveResponses(partial), bookingsPending: ![1, 2, 4].every(i => settled[i]) });
    return { status: 'rejected', reason } as PromiseRejectedResult;
  })));
  return mergeLiveResponses(responses);
}
function mergeLiveResponses(responses: PromiseSettledResult<Json>[]): {jobs: LiveJob[]; warnings: string[]} {
  const successful = responses.filter((response): response is PromiseFulfilledResult<Json> => response.status === 'fulfilled');
  if (!successful.length) {
    const errors = responses.filter((response): response is PromiseRejectedResult => response.status === 'rejected');
    throw new Error('LIVE data unavailable: ' + errors.map(error => error.reason instanceof Error ? error.reason.message : 'Request failed').join('; '));
  }
  const warnings = responses.flatMap((response, index) => response.status === 'rejected' ? [(['Marketplace loads', 'Active bookings', 'Completed bookings', 'Quote history', 'Booking offers'][index]) + ': ' + (response.reason instanceof Error ? response.reason.message : 'Request failed')] : []);
  const [marketplace, assigned, completed, bids, bookingOffers] = responses.map(response => response.status === 'fulfilled' ? response.value : {});
  const result = new Map<string, LiveJob>();
  for (const row of Array.isArray(marketplace.loads) ? marketplace.loads : []) {
    const job = mapMarketplace(row); if (job.id) result.set(job.id, job);
  }
  for (const source of [assigned, completed]) for (const row of Array.isArray(source.jobs) ? source.jobs : []) {
    if (isSimulatedLiveJob(row)) continue;
    const job = mapAssigned(row); if (job.id) result.set(job.id, job);
  }
  for (const raw of Array.isArray(bids.bids) ? bids.bids : []) {
    const bid = obj(raw);
    const id = str(bid.jobId);
    const amount = num(bid.amount);
    if (!id || amount === undefined) continue;
    const state = str(bid.status).toLowerCase();
    const existing = result.get(id);
    const outcome = state === 'accepted' ? 'AWARDED' as const : state === 'rejected' || state === 'unsuccessful' ? 'UNSUCCESSFUL' as const : state === 'cancelled' || state === 'withdrawn' ? 'CANCELLED' as const : undefined;
    const quoteFields = { quote: amount, quoteSubmittedAt: str(bid.createdAt), quoteOutcome: outcome };
    if (existing) {
      result.set(id, { ...existing, ...quoteFields });
    } else {
      result.set(id, { id, from: str(bid.pickupLocation) || 'Collection area', to: str(bid.deliveryLocation) || 'Delivery area', pickup: dateTime(bid.pickupDatetime), delivery: 'Not provided', vehicle: str(bid.quotedVehicleType) || 'Not provided', weight: 0, notes: str(bid.message), status: 'OPEN', company: str(bid.clientName) || 'Marketplace member', pickupDate: date(bid.pickupDatetime), ...quoteFields });
    }
  }
  for (const raw of Array.isArray(bookingOffers.offers) ? bookingOffers.offers : []) {
    const offer = obj(raw);
    const id = str(offer.job_id);
    const state = str(offer.status).toLowerCase();
    if (!id || !['pending', 'accepted'].includes(state)) continue;
    const details = obj(offer.job);
    const existing = result.get(id);
    // An accepted offer is commercial evidence, not the authoritative execution status.
    // Prefer the job's current_status when the assigned-job response is unavailable.
    const executionStatus = str(get(details, 'current_status', 'currentStatus', 'status')).toLowerCase();
    const resolvedExecutionStatus = statusMap[executionStatus];
    const from = str(get(details, 'pickup_location', 'pickup_city', 'pickup_postcode')) || existing?.from || 'Collection';
    const to = str(get(details, 'delivery_location', 'delivery_city', 'delivery_postcode')) || existing?.to || 'Delivery';
    const pending = state === 'pending';
    result.set(id, {
      ...existing,
      id, from, to,
      pickup: dateTime(details.pickup_datetime) !== 'Not provided' ? dateTime(details.pickup_datetime) : existing?.pickup || 'Not provided',
      delivery: dateTime(details.delivery_datetime) !== 'Not provided' ? dateTime(details.delivery_datetime) : existing?.delivery || 'Not provided',
      vehicle: str(get(details, 'requested_vehicle_label', 'vehicle_type')) || existing?.vehicle || 'Not provided',
      weight: existing?.weight || 0,
      notes: str(offer.public_quote_notes) || existing?.notes || '',
      status: existing && existing.status !== 'OPEN' ? existing.status : (resolvedExecutionStatus || 'ALLOCATED'),
      backendStatus: existing?.backendStatus || executionStatus,
      company: str(offer.buyer_name) || existing?.company || 'Transport buyer',
      terms: str(details.payment_terms) || existing?.terms || 'Not provided',
      quote: num(offer.quoted_amount) ?? existing?.quote,
      quoteOutcome: 'AWARDED',
      offerId: str(offer.id),
      acceptanceRequired: pending,
      yourRef: str(offer.public_reference) || existing?.yourRef || id,
    });
  }
  return { jobs: [...result.values()], warnings };
}
