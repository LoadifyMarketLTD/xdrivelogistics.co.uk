// Production driver API adapter. Only publishable Supabase keys are accepted.
import { extractPublicOutcode } from './routeLabel';
const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
type Json = Record<string, unknown>;
export type LiveSession = { token: string; refreshToken: string; expiresAt: number };
export type LiveJob = {
  id: string; from: string; to: string; fromOutcode?: string; toOutcode?: string; pickup: string; delivery: string;
  vehicle: string; weight: number; notes: string; status: 'OPEN' | 'ALLOCATED' | 'ON_WAY_TO_PICKUP' | 'ON_SITE_PICKUP' | 'LOADED' | 'ON_WAY_TO_DELIVERY' | 'ON_SITE_DELIVERY' | 'POD_SUBMITTED' | 'DELIVERED';
  company?: string; companyPublicId?: string; terms?: string; postedAt?: string; distanceMiles?: number; travelMinutes?: number;
  quote?: number; quoteSubmittedAt?: string; quoteOutcome?: 'UNSUCCESSFUL' | 'CANCELLED' | 'AWARDED';
  bidId?: string; bidStatus?: string; quoteEtaMinutes?: number; quoteNotes?: string;
  personalBid?: boolean; // true only for records returned by authenticated /mobile/bids personal quote history
  offerId?: string; acceptanceRequired?: boolean; offerExpired?: boolean; backendStatus?: string; podRecorded?: boolean;
  marketplaceListed?: boolean; // True only for a job returned by the live marketplace feed.
  pickupDate?: string; deliveryDate?: string; pickupAddress?: string; deliveryAddress?: string;
  customerRef?: string; yourRef?: string; service?: string;
  items?: number; hardCopyPodRequired?: boolean;
  statusHistory?: Array<{ status: string; at: string; notes?: string }>;
  clientName?: string; contactName?: string; contactPhone?: string;
  collectionPhotos?: string[]; deliveryPhotos?: string[]; podPhotos?: string[];
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
async function jsonFetch(url: string, init?: RequestInit, timeoutMs?: number): Promise<Json> {
  // Each feed must settle: one stalled endpoint must not freeze the entire app.
  const isWrite = init?.method && !['GET', 'HEAD'].includes(init.method.toUpperCase());
  const deadlineMs = timeoutMs ?? (isWrite ? 25000 : 12000);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), deadlineMs);
  const relayAbort = () => abort.abort();
  init?.signal?.addEventListener('abort', relayAbort, { once: true });
  try {
    const response = await fetch(url, { ...init, signal: abort.signal, headers: { Accept: 'application/json', ...init?.headers }, cache: 'no-store' });
    const body = obj(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(str(body.error_description) || str(body.msg) || str(body.error) || 'API request failed (' + response.status + ')');
    return body;
  } catch (error) {
    if (abort.signal.aborted && !init?.signal?.aborted) {
      throw new Error(isWrite ? 'Request timed out. Its result is unknown. Refresh before attempting the action again.' : 'Live service did not respond within '+Math.round(deadlineMs/1000)+' seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', relayAbort);
  }
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
  return jsonFetch(import.meta.env.PROD ? '/api/booking-offers' : '/xdrive-api/booking-offers', { headers: { Authorization: 'Bearer ' + token } }, 20000);
}
export async function bookingOfferRespond(token: string, offerId: string, action: 'accept' | 'decline'): Promise<Json> {
  return jsonFetch((import.meta.env.PROD ? '/api/booking-offers/' : '/xdrive-api/booking-offers/') + encodeURIComponent(offerId) + '/respond', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
}
export async function driverGet(path: string, token: string, timeoutMs?: number): Promise<Json> {
  if (!token) throw new Error('Driver authentication required');
  return jsonFetch(base + path, { headers: { Authorization: 'Bearer ' + token } }, timeoutMs);
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
    fromOutcode: str(r.pickup_postcode_area), toOutcode: str(r.delivery_postcode_area),
    pickup: dateTime(r.pickup_datetime), delivery: dateTime(r.delivery_datetime),
    pickupDate: date(r.pickup_datetime), deliveryDate: date(r.delivery_datetime),
    vehicle: str(get(r, 'requested_vehicle_label', 'requested_vehicle_type', 'vehicle_type')) || 'Not provided',
    weight: num(r.weight_kg) || 0, notes: str(r.public_quote_notes),
    status: 'OPEN', marketplaceListed: true, company: str(member.name) || 'Marketplace member',
    companyPublicId: str(member.memberId) || undefined,
    terms: str(r.payment_terms) || 'Not provided',
    postedAt: dateTime(r.exchange_posted_at),
    distanceMiles: num(r.distance_miles), travelMinutes: num(r.distance_minutes),
    service: str(r.service_mode) || 'Not provided',
    ...(bidAmount !== undefined ? { quote: bidAmount, quoteOutcome: status === 'accepted' ? 'AWARDED' as const : status === 'cancelled' || status === 'withdrawn' ? 'CANCELLED' as const : undefined, bidStatus: status, bidId: str(bid.id), quoteEtaMinutes: num(bid.collectWithinMinutes), quoteNotes: str(bid.message) } : {}),
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
export function mapAssigned(raw: unknown): LiveJob {
  const r = obj(raw); const details = cleanDetails(get(r, 'loadDetails', 'load_details'));
  const canonicalStatus = str(get(r, 'currentStatus', 'current_status', 'lifecycleStatus', 'lifecycle_status', 'status')).toLowerCase();
  return {
    id: str(r.id), from: str(get(r, 'pickupLocation', 'pickup_location', 'pickupPostcode', 'pickup_postcode')) || 'Collection',
    to: str(get(r, 'deliveryLocation', 'delivery_location', 'deliveryPostcode', 'delivery_postcode')) || 'Delivery',
    fromOutcode: extractPublicOutcode(get(r,'pickupPostcodeArea','pickup_postcode_area','pickupPostcode','pickup_postcode')),
    toOutcode: extractPublicOutcode(get(r,'deliveryPostcodeArea','delivery_postcode_area','deliveryPostcode','delivery_postcode')),
    pickup: dateTime(get(r, 'pickupTime', 'pickupDatetime', 'pickup_datetime')),
    delivery: dateTime(get(r, 'deliveryTime', 'deliveryDatetime', 'delivery_datetime')),
    pickupDate: date(get(r, 'pickupTime', 'pickupDatetime', 'pickup_datetime')),
    deliveryDate: date(get(r, 'deliveryTime', 'deliveryDatetime', 'delivery_datetime')),
    vehicle: str(get(r, 'vehicleRequirement', 'vehicleType', 'vehicle_type')) || 'Not provided',
    weight: num(get(r, 'weightKg', 'weight_kg')) || 0,
    items: num(get(r, 'itemCount', 'no_of_items')),
    hardCopyPodRequired: /^(required|yes|true|1)$/i.test(str(get(r, 'hardCopyPod', 'hard_copy_pod'))) || get(r, 'hardCopyPodRequired') === true,
    notes: details.notes || str(get(r, 'collectionNotes', 'driverNotes', 'driver_notes')),
    status: statusMap[canonicalStatus] || 'ALLOCATED', backendStatus: canonicalStatus, podRecorded: r.podGenerated === true && Boolean(r.deliverySignatureData) && Boolean(str(r.clientSignatureName)),
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
    statusHistory: Array.isArray(r.statusHistory) ? r.statusHistory.map(item=>{const e=obj(item);return {status:str(get(e,'status','nextStatus','event','eventType'))||'Status update',at:str(get(e,'at','timestamp','created_at','createdAt','occurred_at')),notes:str(get(e,'notes','message'))};}) : [],
    clientName: str(r.clientName),contactName: str(r.contactName),contactPhone: str(r.contactPhone),
    collectionPhotos: Array.isArray(r.pickupPhotos)?r.pickupPhotos.filter(v=>typeof v==='string'):[],
    deliveryPhotos: Array.isArray(r.deliveryPhotos)?r.deliveryPhotos.filter(v=>typeof v==='string'):[],
    podPhotos: Array.isArray(r.podPhotos)?r.podPhotos.filter(v=>typeof v==='string'):[],
  };
}
export async function loadLive(token: string): Promise<LiveJob[]> {
  return (await loadLiveWithDiagnostics(token)).jobs;
}
export async function loadLiveWithDiagnostics(token: string, offerData?: Json, includeBidHistory = true): Promise<{jobs: LiveJob[]; warnings: string[]}> {
  const responses = await Promise.allSettled([
    driverGet('/marketplace/loads', token, 10000),
    driverGet('/mobile/jobs?scope=bookings&compact=1', token, 10000),
    driverGet('/mobile/jobs?scope=completed&compact=1', token, 10000),
    includeBidHistory ? driverGet('/mobile/bids', token, 30000) : Promise.resolve({}),
    Promise.resolve(offerData ?? {}),
  ]);
  const successful = responses.filter((response): response is PromiseFulfilledResult<Json> => response.status === 'fulfilled');
  if (!successful.length) {
    const errors = responses.filter((response): response is PromiseRejectedResult => response.status === 'rejected');
    throw new Error('LIVE data unavailable: ' + errors.map(error => error.reason instanceof Error ? error.reason.message : 'Request failed').join('; '));
  }
  const warnings = responses.flatMap((response, index) => response.status === 'rejected' ? [(['Marketplace loads', 'Active bookings', 'Completed bookings', 'Quote history', 'Booking offers'][index]) + ': ' + (response.reason instanceof Error ? response.reason.message : 'Request failed')] : []);
  const [marketplace, assigned, completed, bids, bookingOffers] = responses.map(response => response.status === 'fulfilled' ? response.value : {}) as Json[];
  const result = new Map<string, LiveJob>();
  for (const row of Array.isArray(marketplace.loads) ? marketplace.loads : []) {
    const job = mapMarketplace(row); if (job.id) result.set(job.id, job);
  }
  for (const source of [assigned, completed]) for (const row of Array.isArray(source.jobs) ? source.jobs : []) {
    if (isSimulatedLiveJob(row)) continue;
    const job = mapAssigned(row); if (job.id) result.set(job.id, job);
  }
  const coreJobs=applyPersonalBids([...result.values()], bids);

  return {jobs:offerData?applyBookingOffers(coreJobs,bookingOffers):coreJobs,warnings};
}
export function applyPersonalBids(jobs:LiveJob[], bids:Json):LiveJob[] {
  const result=new Map(jobs.map(job=>[job.id,job]));
  for (const raw of Array.isArray(bids.bids) ? bids.bids : []) {
    const bid = obj(raw);
    const id = str(bid.jobId);
    const amount = num(bid.amount);
    if (!id || amount === undefined) continue;
    const state = str(bid.status).toLowerCase();
    const existing = result.get(id);
    const outcome = state === 'accepted' ? 'AWARDED' as const : state === 'rejected' || state === 'unsuccessful' ? 'UNSUCCESSFUL' as const : state === 'cancelled' || state === 'withdrawn' ? 'CANCELLED' as const : undefined;
    const quoteFields = { quote: amount, quoteSubmittedAt: str(bid.createdAt), quoteOutcome: outcome,
      bidId: str(bid.id), bidStatus: state, quoteEtaMinutes: num(bid.collectWithinMinutes), quoteNotes: str(bid.message), personalBid: true };
    if (existing) {
      result.set(id, { ...existing, ...quoteFields });
    } else {
      result.set(id, { id, from: str(bid.pickupLocation) || 'Collection area', to: str(bid.deliveryLocation) || 'Delivery area', pickup: dateTime(bid.pickupDatetime), delivery: 'Not provided', vehicle: str(bid.quotedVehicleType) || 'Not provided', weight: 0, notes: str(bid.message), status: 'OPEN', company: str(bid.clientName) || 'Marketplace member', pickupDate: date(bid.pickupDatetime), ...quoteFields });
    }
  }
  return [...result.values()];
}
export function applyBookingOffers(jobs:LiveJob[], bookingOffers:Json):LiveJob[] {
  const result=new Map(jobs.map(job=>[job.id,job]));
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
    const pickupAt = Date.parse(str(get(details, 'pickup_datetime','pickupDatetime')));
    const offerExpired = pending && Number.isFinite(pickupAt) && pickupAt < Date.now();
    result.set(id, {
      ...existing,
      id, from, to,
      fromOutcode: existing?.fromOutcode || extractPublicOutcode(get(details,'pickup_postcode_area','pickup_postcode','pickupPostcode')),
      toOutcode: existing?.toOutcode || extractPublicOutcode(get(details,'delivery_postcode_area','delivery_postcode','deliveryPostcode')),
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
      offerExpired,
      yourRef: str(offer.public_reference) || existing?.yourRef || id,
    });
  }
  return [...result.values()];
}
