// Production driver API adapter. Only publishable Supabase keys are accepted.
const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
type Json = Record<string, unknown>;
export type LiveSession = { token: string; refreshToken: string; expiresAt: number };
export type LiveJob = {
  id: string; from: string; to: string; pickup: string; delivery: string;
  vehicle: string; weight: number; notes: string; status: 'OPEN' | 'ALLOCATED' | 'ON_WAY_TO_PICKUP' | 'ON_SITE_PICKUP' | 'LOADED' | 'ON_WAY_TO_DELIVERY' | 'ON_SITE_DELIVERY' | 'POD_SUBMITTED' | 'DELIVERED';
  company?: string; terms?: string; postedAt?: string; distanceMiles?: number; travelMinutes?: number;
  quote?: number; quoteSubmittedAt?: string; quoteOutcome?: 'UNSUCCESSFUL' | 'CANCELLED' | 'AWARDED';
  pickupDate?: string; deliveryDate?: string; pickupAddress?: string; deliveryAddress?: string;
  customerRef?: string; yourRef?: string; service?: string;
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
  const response = await fetch(url, { ...init, headers: { Accept: 'application/json', ...init?.headers }, cache: 'no-store' });
  const body = obj(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(str(body.error) || 'API request failed (' + response.status + ')');
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
  return { token, refreshToken: str(auth.refresh_token), expiresAt: Date.now() + (num(auth.expires_in) || 3600) * 1000 };
}
export async function renewSession(session: LiveSession): Promise<LiveSession> {
  if (session.expiresAt > Date.now() + 120000) return session;
  if (!session.refreshToken) throw new Error('Session expired. Please sign in again.');
  const config = await jsonFetch(base + '/mobile/config');
  const url = str(config.supabaseUrl);
  const key = str(config.supabaseAnonKey);
  if (url !== 'https://jqxlauexhkonixtjvljw.supabase.co' || !key) throw new Error('LIVE authentication configuration mismatch');
  const auth = await jsonFetch(url + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  const token = str(auth.access_token);
  if (!token) throw new Error('Session renewal failed');
  return {
    token,
    refreshToken: str(auth.refresh_token) || session.refreshToken,
    expiresAt: Date.now() + (num(auth.expires_in) || 3600) * 1000,
  };
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
    pickup: dateTime(r.pickup_datetime), delivery: dateTime(r.delivery_datetime),
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
  on_way_to_pickup: 'ON_WAY_TO_PICKUP', on_site_pickup: 'ON_SITE_PICKUP',
  loaded: 'LOADED', on_way_to_delivery: 'ON_WAY_TO_DELIVERY',
  on_site_delivery: 'ON_SITE_DELIVERY', pod_submitted: 'POD_SUBMITTED',
  delivered: 'DELIVERED', completed: 'DELIVERED',
};
export function mapAssigned(raw: unknown): LiveJob {
  const r = obj(raw); const status = str(get(r, 'currentStatus', 'current_status', 'status')).toLowerCase(); const details = cleanDetails(get(r, 'loadDetails', 'load_details'));
  return {
    id: str(r.id), from: str(get(r, 'pickupLocation', 'pickup_location', 'pickupPostcode', 'pickup_postcode')) || 'Collection',
    to: str(get(r, 'deliveryLocation', 'delivery_location', 'deliveryPostcode', 'delivery_postcode')) || 'Delivery',
    pickup: dateTime(get(r, 'pickupTime', 'pickupDatetime', 'pickup_datetime')),
    delivery: dateTime(get(r, 'deliveryTime', 'deliveryDatetime', 'delivery_datetime')),
    pickupDate: date(get(r, 'pickupTime', 'pickupDatetime', 'pickup_datetime')),
    deliveryDate: date(get(r, 'deliveryTime', 'deliveryDatetime', 'delivery_datetime')),
    vehicle: str(get(r, 'vehicleRequirement', 'vehicleType', 'vehicle_type')) || 'Not provided',
    weight: num(get(r, 'weightKg', 'weight_kg')) || 0,
    notes: details.notes || str(get(r, 'collectionNotes', 'driverNotes', 'driver_notes')),
    status: statusMap[status] || 'ALLOCATED',
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
  };
}
export async function loadLive(token: string): Promise<LiveJob[]> {
  return (await loadLiveWithDiagnostics(token)).jobs;
}
export async function loadLiveWithDiagnostics(token: string): Promise<{jobs: LiveJob[]; warnings: string[]}> {
  const responses = await Promise.allSettled([
    driverGet('/marketplace/loads', token),
    driverGet('/mobile/jobs?scope=active', token),
    driverGet('/mobile/jobs?scope=completed', token),
    driverGet('/mobile/bids', token),
  ]);
  const successful = responses.filter((response): response is PromiseFulfilledResult<Json> => response.status === 'fulfilled');
  if (!successful.length) {
    const errors = responses.filter((response): response is PromiseRejectedResult => response.status === 'rejected');
    throw new Error('LIVE data unavailable: ' + errors.map(error => error.reason instanceof Error ? error.reason.message : 'Request failed').join('; '));
  }
  const warnings = responses.flatMap((response, index) => response.status === 'rejected' ? [(['Marketplace loads', 'Active bookings', 'Completed bookings', 'Quote history'][index]) + ': ' + (response.reason instanceof Error ? response.reason.message : 'Request failed')] : []);
  const [marketplace, assigned, completed, bids] = responses.map(response => response.status === 'fulfilled' ? response.value : {});
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
  return { jobs: [...result.values()], warnings };
}
