/** Real XDrive API client. Never falls back to TEST fixtures or localStorage. */
export type MarketplaceJob = {
  id: string; pickup_location: string | null; pickup_postcode: string | null;
  delivery_location: string | null; delivery_postcode: string | null;
  pickup_datetime: string | null; delivery_datetime: string | null;
  requested_vehicle_label: string | null; vehicle_type: string | null;
  weight_kg: number | null; load_details: string | null;
  posterName: string; journeyDistanceMiles: number | null; exchange_posted_at?: string | null; requested_cargo_label?: string | null; cargo_type?: string | null; pallets?: number | null; service_mode?: string | null;
};
export type DriverBid = {
  id: string; jobId: string; amount: number | null; status: string;
  collectWithinMinutes?: number | null; message: string;
  pickupLocation?: string; deliveryLocation?: string;
};
export type AssignedJob = {
  id: string; status?: string; current_status?: string;
  pickupLocation?: string | null; deliveryLocation?: string | null;
  pickupTime?: string | null; canonicalStatus?: string; createdAt?: string | null;
  jobDistanceMiles?: number | null; vehicleType?: string | null;
  postingCompanyName?: string | null; agreedRateAmount?: number | null; lifecycleGroup?: string;
};
export type DriverJobSheet = {
  reference?: string | null; bookedBy?: string | null; pickupCompany?: string | null; deliveryCompany?: string | null; customerName?: string | null; customerReference?: string | null; paymentTerms?: string | null; paymentDueDays?: number | null; agreedRate?: number | null; distanceMiles?: number | null; requestedVehicle?: string | null; executionInstructions?: string | null; hardCopyPod?: string | null; cargo?: { type?: string | null; weightKg?: number | null; pallets?: number | null; lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null }; pickup?: { address?: string | null; postcode?: string | null; dateTime?: string | null; contactName?: string | null; contactPhone?: string | null; notes?: string | null }; delivery?: { address?: string | null; postcode?: string | null; dateTime?: string | null; contactName?: string | null; contactPhone?: string | null; notes?: string | null }; requirements?: string[]; documents?: Array<{ fileName?: string | null }>;
};
export type RealDriverSnapshot = {
  marketplace: MarketplaceJob[]; bids: DriverBid[]; bookings: AssignedJob[]; sheets: Record<string, DriverJobSheet>;
};
export class DriverApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; this.name = 'DriverApiError'; }
}
export function makeDriverApi(getAccessToken: () => Promise<string | null>) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getAccessToken();
    if (!token) throw new DriverApiError(401, 'Please sign in to XDrive Logistics.');
    const response = await fetch(path, {
      ...init,
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...init?.headers },
      credentials: 'same-origin', cache: 'no-store',
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const serverMessage = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error : `XDrive API error (${response.status})`;
      const message = response.status === 401
        ? 'Your XDrive session has expired. Please sign in again.'
        : response.status === 403
          ? (serverMessage.includes('Commercial marketplace access is not enabled') ? serverMessage : 'XDrive denied access to driver data (403). Check the signed-in driver account and workspace permissions.')
          : serverMessage;
      throw new DriverApiError(response.status, message);
    }
    return payload as T;
  }
  return {
    async loadSnapshot(onBase?: (snapshot: RealDriverSnapshot) => void): Promise<RealDriverSnapshot> {
      // No silent partial success: never present a fake or incomplete operational feed.
      const [market, quotes, active, completed] = await Promise.all([
        request<{ rows: MarketplaceJob[] }>('/api/driver/search-loads?pageSize=50').catch((error: unknown) => {
          // Marketplace access is restricted, but assigned bookings remain available.
          if (error instanceof DriverApiError && error.status === 403 && error.message.includes('Commercial marketplace access is not enabled')) return { rows: [] as MarketplaceJob[] };
          throw error;
        }),
        request<{ bids: DriverBid[] }>('/api/driver/official-pwa/bids'),
        request<{ jobs: AssignedJob[] }>('/api/driver/jobs?scope=active'),
        request<{ jobs: AssignedJob[] }>('/api/driver/jobs?scope=completed'),
      ]);
      if (!Array.isArray(market.rows) || !Array.isArray(quotes.bids) || !Array.isArray(active.jobs) || !Array.isArray(completed.jobs)) {
        throw new DriverApiError(502, 'XDrive returned an invalid driver feed.');
      }
      const bookings = [...active.jobs, ...completed.jobs.filter(job => !active.jobs.some(a => a.id === job.id))];
      const sheets: Record<string, DriverJobSheet> = {};
      // Show authorised marketplace and booking summaries before the slower per-booking sheets finish.
      onBase?.({marketplace:market.rows, bids:quotes.bids, bookings, sheets:{}});
      await Promise.all(bookings.map(async job => {
        try { const result = await request<{sheet:DriverJobSheet}>(`/api/driver/jobs/${encodeURIComponent(job.id)}/sheet`); if(result.sheet) sheets[job.id]=result.sheet; } catch { /* Missing sheet is explicit in card, never fabricate details. */ }
      }));
      return {
        marketplace: market.rows,
        bids: quotes.bids,
        bookings, sheets,
      };
    },
    updateJobStatus(jobId: string, action: string, driverNotes = '') {
      const allowed = ['accept', 'on-my-way-pickup', 'arrived-pickup', 'loaded', 'on-my-way-delivery', 'arrived-delivery', 'delivered'];
      if (!jobId || jobId.startsWith('TEST-') || !allowed.includes(action)) throw new DriverApiError(400, 'Invalid job action.');
      if (driverNotes.length > 5000) throw new DriverApiError(400, 'Driver notes are too long.');
      return request<unknown>('/api/driver/web/jobs/' + encodeURIComponent(jobId) + '/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driverNotes }) });
    },
    submitQuote(jobId: string, amount: number, collectWithinMinutes: number | null, message: string) {
      if (!jobId || jobId.startsWith('TEST-') || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        throw new DriverApiError(400, 'Invalid quote.');
      }
      if (collectWithinMinutes !== null && (!Number.isInteger(collectWithinMinutes) || collectWithinMinutes < 5 || collectWithinMinutes > 240)) {
        throw new DriverApiError(400, 'Collection ETA must be between 5 and 240 minutes.');
      }
      if (message.length > 1_000) throw new DriverApiError(400, 'Quote message is too long.');
      return request<{ success: boolean; bidId: string }>('/api/driver/bids', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, amount, collectWithinMinutes, message }),
      });
    },
  };
}





