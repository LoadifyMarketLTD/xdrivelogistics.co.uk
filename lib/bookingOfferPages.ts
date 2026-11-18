export async function fetchAllBookingOfferPages<T>(endpoint: string, token: string): Promise<T[]> {
  const offers: T[] = [];
  for (let page = 0; page <= 10000; page++) {
    const response = await fetch(`${endpoint}?page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as {
      offers?: T[]; error?: string; hasMore?: boolean;
    };
    if (!response.ok) throw new Error(payload.error ?? 'Booking offers could not be loaded.');
    offers.push(...(payload.offers ?? []));
    if (!payload.hasMore) return offers;
  }
  throw new Error('Booking offer history exceeds the supported page range.');
}
